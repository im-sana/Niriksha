"""
Niriksha Backend — FastAPI Application (v2)
============================================
Production-ready version with:
  - JWT authentication via new /auth/* routes
  - Protected exam endpoints via /exam/* routes  
  - Admin dashboard endpoints via /dashboard/* routes
  - Rate limiting on analyze_frame (2 req/s)
  - Screenshot capture on HIGH risk events
  - Claude AI integrations

IMPORTANT: All existing AI detection modules are UNTOUCHED.
           The detection pipeline (face, eye, phone, etc.) is preserved exactly.
           New features are added via include_router() calls only.

Original detection endpoints kept for backward compatibility:
  POST /analyze_frame    (legacy, no auth)
  POST /start_exam       (legacy, no auth)
  POST /submit_exam      (legacy, no auth)
  GET  /dashboard_stats  (legacy, no auth)
  WS   /ws/exam/{id}     (unchanged)
"""
import asyncio
import base64
import json
import os
import sys
import time
from datetime import datetime
from typing import Optional, List

# Ensure backend directory is in path for relative imports
_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

import cv2
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# Load environment variables FIRST
load_dotenv()

# Import detection modules (UNTOUCHED — preserving all existing logic)
from detection_modules.face_detection   import FaceDetector
from detection_modules.face_mesh        import FaceMeshAnalyzer
from detection_modules.eye_movement     import EyeMovementDetector
from detection_modules.head_pose        import HeadPoseEstimator
from detection_modules.multi_face       import MultiFaceDetector
from detection_modules.phone_detection  import PhoneDetector
from detection_modules.hand_detection   import HandDetector
from detection_modules.talking_detection import TalkingDetector
from detection_modules.cheating_score   import CheatingScoreEngine

# Database
from database.connection import get_database, close_connection

# New route modules
from routes.auth_routes      import router as auth_router
from routes.exam_routes      import router as exam_router
from routes.dashboard_routes import router as dashboard_router

# Rate limiter
from utils.rate_limiter import limiter

# ── App init ──────────────────────────────────────────────────
app = FastAPI(
    title="Niriksha API",
    description="AI-powered hybrid exam cheating detection system — Production v2",
    version="2.0.0",
)

# ── Rate limiter middleware ────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount new routers ─────────────────────────────────────────
app.include_router(auth_router)
app.include_router(exam_router)
app.include_router(dashboard_router)

# ── Serve screenshot files (admin access controlled by route handler) ──
SCREENSHOTS_DIR = os.getenv("SCREENSHOTS_DIR", "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

# ── Lazy init AI modules ──────────────────────────────────────
face_detector  = FaceDetector()
face_mesh      = FaceMeshAnalyzer()
eye_detector   = EyeMovementDetector()
head_estimator = HeadPoseEstimator()
multi_face     = MultiFaceDetector()
phone_detector = PhoneDetector()
hand_detector  = HandDetector()
talk_detector  = TalkingDetector()

# Cheating Score Engine
score_engine = CheatingScoreEngine()

# Active WebSocket connections: {session_id: [WebSocket, ...]}
active_connections: dict[str, List[WebSocket]] = {}


# ══════════════════════════════════════════════════════════════
# Lifecycle Events
# ══════════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup():
    """Verify DB connection on startup."""
    try:
        await get_database()
        print("[Niriksha] ✅ Database connected")
    except RuntimeError as e:
        print(f"[Niriksha] ⚠️  {e}")
        print("[Niriksha] Starting without DB — auth features will fail.")


@app.on_event("shutdown")
async def shutdown():
    await close_connection()
    print("[Niriksha] Database connection closed.")


# ══════════════════════════════════════════════════════════════
# Pydantic Schemas (legacy endpoints)
# ══════════════════════════════════════════════════════════════

class StartExamRequest(BaseModel):
    student_id: str
    exam_id: str
    student_name: Optional[str] = "Student"

class SubmitExamRequest(BaseModel):
    student_id: str
    exam_id: str
    answers: dict
    cheat_score: float

class FrameAnalysisRequest(BaseModel):
    """Frame sent as base64 JPEG from the browser webcam."""
    session_id: str
    frame_b64: str


# ══════════════════════════════════════════════════════════════
# Helper: Broadcast to WebSocket subscribers
# ══════════════════════════════════════════════════════════════

async def broadcast(session_id: str, payload: dict):
    """Send JSON payload to all WebSocket subscribers of a session."""
    connections = active_connections.get(session_id, [])
    dead = []
    for ws in connections:
        try:
            await ws.send_json(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        connections.remove(ws)


# ══════════════════════════════════════════════════════════════
# Health + Root
# ══════════════════════════════════════════════════════════════

@app.get("/")
async def root():
    return {"message": "Niriksha API v2.0", "status": "running", "docs": "/docs"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    try:
        db = await get_database()
        await db.command("ping")
        db_status = "connected"
    except Exception:
        db_status = "unavailable"
    return {"status": "ok", "database": db_status, "version": "2.0.0"}


# ══════════════════════════════════════════════════════════════
# Legacy REST Endpoints (kept for backward compatibility)
# These work WITHOUT JWT — new /exam/* versions require JWT
# ══════════════════════════════════════════════════════════════

@app.post("/start_exam")
async def start_exam(req: StartExamRequest):
    """Initialize a new exam session (legacy, no auth required)."""
    db = await get_database()
    session = {
        "student_id":   req.student_id,
        "exam_id":      req.exam_id,
        "student_name": req.student_name,
        "start_time":   datetime.utcnow().isoformat(),
        "cheat_score":  0,
        "events":       [],
        "status":       "active",
    }
    result = await db.sessions.insert_one(session)
    score_engine.reset(req.student_id)
    return {
        "session_id": str(result.inserted_id),
        "message": f"Exam session started for {req.student_name}",
        "student_id": req.student_id,
        "exam_id": req.exam_id,
    }


@app.post("/submit_exam")
async def submit_exam(req: SubmitExamRequest):
    """Submit exam answers (legacy, no auth required)."""
    db = await get_database()
    await db.sessions.update_one(
        {"student_id": req.student_id, "exam_id": req.exam_id, "status": "active"},
        {"$set": {
            "status":      "submitted",
            "answers":     req.answers,
            "cheat_score": req.cheat_score,
            "end_time":    datetime.utcnow().isoformat(),
        }}
    )
    flagged = req.cheat_score >= 15
    return {"message": "Exam submitted", "flagged": flagged, "cheat_score": req.cheat_score}


@app.post("/analyze_frame")
async def analyze_frame(req: FrameAnalysisRequest):
    """
    Frame analysis — legacy endpoint (no auth, for backward compat).
    New /exam/analyze_frame requires JWT + is rate-limited.
    """
    try:
        img_bytes = base64.b64decode(req.frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Could not decode image")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid frame: {e}")

    results = {}
    events  = []

    # ── Detection pipeline (UNTOUCHED) ──────────────────────────
    face_result = face_detector.detect(frame)
    results["face_present"] = face_result.face_present
    if not face_result.face_present:
        events.append({"type": "face_missing", "message": "Face not visible", "score": 5})

    mesh_result = face_mesh.analyze(frame)

    if mesh_result.landmarks:
        eye_result = eye_detector.detect(mesh_result.landmarks, frame.shape)
        results["gaze"] = eye_result.direction
        if eye_result.direction in ("left", "right"):
            events.append({"type": f"look_{eye_result.direction}", "message": f"Looking {eye_result.direction}", "score": 2})
        elif eye_result.direction == "down":
            events.append({"type": "look_down", "message": "Looking down", "score": 3})

        talk_result = talk_detector.detect(mesh_result.landmarks)
        results["talking"] = talk_result.is_talking
        if talk_result.is_talking:
            events.append({"type": "talking", "message": "Possible talking detected", "score": 3})

    if mesh_result.landmarks:
        head_result = head_estimator.estimate(frame, mesh_result.landmarks)
        results["head_pose"] = head_result.direction
        if head_result.direction in ("left", "right", "down"):
            events.append({"type": f"head_{head_result.direction}", "message": f"Head turned {head_result.direction}", "score": 2})

    multi_result = multi_face.detect(frame)
    results["face_count"] = multi_result.face_count
    if multi_result.face_count > 1:
        events.append({"type": "multiple_faces", "message": f"{multi_result.face_count} faces detected", "score": 10})

    phone_result = phone_detector.detect(frame)
    results["phone_detected"] = phone_result.detected
    if phone_result.detected:
        events.append({"type": "phone_detected", "message": "Mobile phone detected", "score": 10})

    hand_result = hand_detector.detect(frame)
    results["hand_suspicious"] = hand_result.suspicious
    if hand_result.suspicious:
        events.append({"type": "suspicious_hand", "message": "Suspicious hand movement", "score": 2})

    # ── Score update ──────────────────────────────────────────────
    score_engine.add_events(req.session_id, events)
    total_score = score_engine.get_score(req.session_id)
    flagged     = total_score >= 15

    # ── Save to DB ────────────────────────────────────────────────
    try:
        db = await get_database()
        if events:
            await db.cheating_logs.insert_many([
                {**e, "session_id": req.session_id, "timestamp": datetime.utcnow().isoformat()}
                for e in events
            ])
    except Exception:
        pass

    # ── WebSocket broadcast ───────────────────────────────────────
    if events:
        await broadcast(req.session_id, {
            "type":        "detection_update",
            "events":      events,
            "cheat_score": total_score,
            "flagged":     flagged,
            "face_status": "Face Detected" if results.get("face_present") else "Face Missing",
        })

    return {"events": events, "cheat_score": total_score, "flagged": flagged, "results": results}


@app.get("/student_report")
async def student_report(student_id: str, exam_id: str):
    """Get comprehensive report for a student exam session (legacy)."""
    db = await get_database()
    session = await db.sessions.find_one({"student_id": student_id, "exam_id": exam_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session_id = str(session["_id"])
    session["_id"] = session_id
    logs = await db.cheating_logs.find({"session_id": session_id}).to_list(100)
    for log in logs:
        log["_id"] = str(log["_id"])
    return {"session": session, "logs": logs}


@app.get("/cheating_logs")
async def cheating_logs(session_id: Optional[str] = None, limit: int = 50):
    """Retrieve cheating event logs (legacy)."""
    db = await get_database()
    query = {"session_id": session_id} if session_id else {}
    logs = await db.cheating_logs.find(query).sort("timestamp", -1).to_list(limit)
    for log in logs:
        log["_id"] = str(log["_id"])
    return {"logs": logs, "total": len(logs)}


@app.get("/dashboard_stats")
async def dashboard_stats():
    """Aggregate dashboard stats (legacy endpoint, no auth)."""
    db = await get_database()
    total_sessions = await db.sessions.count_documents({})
    flagged        = await db.sessions.count_documents({"cheat_score": {"$gte": 15}})
    total_events   = await db.cheating_logs.count_documents({})
    pipeline       = [{"$group": {"_id": None, "avg": {"$avg": "$cheat_score"}}}]
    avg_result     = await db.sessions.aggregate(pipeline).to_list(1)
    avg_score      = round(avg_result[0]["avg"], 1) if avg_result else 0
    recent         = await db.sessions.find({}).sort("start_time", -1).to_list(10)
    for s in recent:
        s["_id"] = str(s["_id"])
    return {
        "total_sessions": total_sessions,
        "flagged_count":  flagged,
        "total_events":   total_events,
        "avg_cheat_score": avg_score,
        "recent_sessions": recent,
    }


# ══════════════════════════════════════════════════════════════
# WebSocket Endpoint (UNCHANGED)
# ══════════════════════════════════════════════════════════════

@app.websocket("/ws/exam/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket connection for real-time event streaming.
    Frontend connects here to receive live cheating alerts.
    UNCHANGED from v1.
    """
    await websocket.accept()

    if session_id not in active_connections:
        active_connections[session_id] = []
    active_connections[session_id].append(websocket)

    await websocket.send_json({
        "type":        "connected",
        "session_id":  session_id,
        "message":     "Niriksha monitoring active",
        "face_status": "Initializing detectors...",
    })

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif msg.get("type") == "browser_event":
                    event_type = msg.get("event")
                    score_engine.add_events(session_id, [{"type": event_type, "score": 10}])
                    total = score_engine.get_score(session_id)
                    await broadcast(session_id, {
                        "type":        "browser_cheat",
                        "event":       event_type,
                        "message":     msg.get("message", event_type),
                        "cheat_score": total,
                        "flagged":     total >= 15,
                    })
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        if websocket in active_connections.get(session_id, []):
            active_connections[session_id].remove(websocket)
        print(f"[WS] Client disconnected: {session_id}")
