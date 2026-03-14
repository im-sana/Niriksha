"""
Niriksha Backend — FastAPI Application
=========================================
Main entry point. Provides:
  - REST API endpoints for exam management and reporting
  - WebSocket endpoint for real-time cheating alert streaming
  - CORS configured for React frontend (localhost:5173)
  - MongoDB via Motor async client
"""
import asyncio
import base64
import json
import time
from datetime import datetime
from typing import Optional, List

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import detection modules
from detection_modules.face_detection  import FaceDetector
from detection_modules.face_mesh       import FaceMeshAnalyzer
from detection_modules.eye_movement    import EyeMovementDetector
from detection_modules.head_pose       import HeadPoseEstimator
from detection_modules.multi_face      import MultiFaceDetector
from detection_modules.phone_detection import PhoneDetector
from detection_modules.hand_detection  import HandDetector
from detection_modules.talking_detection import TalkingDetector
from detection_modules.cheating_score  import CheatingScoreEngine

# Database
from database.connection import get_database

# ── App init ──────────────────────────────────────────────────
app = FastAPI(
    title="Niriksha API",
    description="AI-powered hybrid exam cheating detection system",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Lazy init AI modules (initialized on first request) ───────
face_detector   = FaceDetector()
face_mesh       = FaceMeshAnalyzer()
eye_detector    = EyeMovementDetector()
head_estimator  = HeadPoseEstimator()
multi_face      = MultiFaceDetector()
phone_detector  = PhoneDetector()
hand_detector   = HandDetector()
talk_detector   = TalkingDetector()

# Cheating Score Engine (in-memory + MongoDB)
score_engine    = CheatingScoreEngine()

# Active WebSocket connections: {session_id: [WebSocket, ...]}
active_connections: dict[str, List[WebSocket]] = {}


# ══════════════════════════════════════════════════════════════
# Pydantic Schemas
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
    frame_b64: str  # base64-encoded JPEG


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
# REST Endpoints
# ══════════════════════════════════════════════════════════════

@app.get("/")
async def root():
    return {"message": "Niriksha API v1.0", "status": "running"}


@app.post("/start_exam")
async def start_exam(req: StartExamRequest):
    """
    Initialize a new exam session for a student.
    Stores session record in MongoDB.
    """
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
    # Reset score engine for this student
    score_engine.reset(req.student_id)
    return {
        "session_id": str(result.inserted_id),
        "message": f"Exam session started for {req.student_name}",
        "student_id": req.student_id,
        "exam_id": req.exam_id,
    }


@app.post("/submit_exam")
async def submit_exam(req: SubmitExamRequest):
    """
    Submit exam answers and finalize the session in MongoDB.
    """
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
    return {
        "message":  "Exam submitted",
        "flagged":  flagged,
        "cheat_score": req.cheat_score,
    }


@app.post("/analyze_frame")
async def analyze_frame(req: FrameAnalysisRequest):
    """
    Receive a base64-encoded webcam frame, run all AI detection modules,
    update the cheating score, broadcast alerts via WebSocket.
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

    # ── Run detection pipeline ──
    # 1. Face detection
    face_result = face_detector.detect(frame)
    results["face_present"] = face_result.face_present
    if not face_result.face_present:
        events.append({"type": "face_missing", "message": "Face not visible", "score": 5})

    # 2. Face mesh (landmarks for eye + talking)
    mesh_result = face_mesh.analyze(frame)

    # 3. Eye movement
    if mesh_result.landmarks:
        eye_result = eye_detector.detect(mesh_result.landmarks, frame.shape)
        results["gaze"] = eye_result.direction
        if eye_result.direction in ("left", "right"):
            events.append({"type": f"look_{eye_result.direction}", "message": f"Looking {eye_result.direction}", "score": 2})
        elif eye_result.direction == "down":
            events.append({"type": "look_down", "message": "Looking down", "score": 3})

        # 4. Talking detection
        talk_result = talk_detector.detect(mesh_result.landmarks)
        results["talking"] = talk_result.is_talking
        if talk_result.is_talking:
            events.append({"type": "talking", "message": "Possible talking detected", "score": 3})

    # 5. Head pose
    if mesh_result.landmarks:
        head_result = head_estimator.estimate(frame, mesh_result.landmarks)
        results["head_pose"] = head_result.direction
        if head_result.direction in ("left", "right", "down"):
            events.append({"type": f"head_{head_result.direction}", "message": f"Head turned {head_result.direction}", "score": 2})

    # 6. Multiple faces (YOLOv8)
    multi_result = multi_face.detect(frame)
    results["face_count"] = multi_result.face_count
    if multi_result.face_count > 1:
        events.append({"type": "multiple_faces", "message": f"{multi_result.face_count} faces detected", "score": 10})

    # 7. Phone detection (YOLOv8)
    phone_result = phone_detector.detect(frame)
    results["phone_detected"] = phone_result.detected
    if phone_result.detected:
        events.append({"type": "phone_detected", "message": "Mobile phone detected", "score": 10})

    # 8. Hand movement
    hand_result = hand_detector.detect(frame)
    results["hand_suspicious"] = hand_result.suspicious
    if hand_result.suspicious:
        events.append({"type": "suspicious_hand", "message": "Suspicious hand movement", "score": 2})

    # ── Update cheating score ──
    score_engine.add_events(req.session_id, events)
    total_score = score_engine.get_score(req.session_id)
    flagged     = total_score >= 15

    # ── Save events to MongoDB (fire-and-forget) ──
    try:
        db = await get_database()
        if events:
            await db.cheating_logs.insert_many([
                {**e, "session_id": req.session_id, "timestamp": datetime.utcnow().isoformat()}
                for e in events
            ])
    except Exception:
        pass  # DB write failure shouldn't block response

    # ── Broadcast via WebSocket ──
    if events:
        await broadcast(req.session_id, {
            "type": "detection_update",
            "events": events,
            "cheat_score": total_score,
            "flagged": flagged,
            "face_status": "Face Detected" if results.get("face_present") else "Face Missing",
        })

    return {
        "events":      events,
        "cheat_score": total_score,
        "flagged":     flagged,
        "results":     results,
    }


@app.get("/student_report")
async def student_report(student_id: str, exam_id: str):
    """Get comprehensive report for a student exam session."""
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
    """Retrieve cheating event logs, optionally filtered by session."""
    db = await get_database()
    query = {"session_id": session_id} if session_id else {}
    logs = await db.cheating_logs.find(query).sort("timestamp", -1).to_list(limit)
    for log in logs:
        log["_id"] = str(log["_id"])
    return {"logs": logs, "total": len(logs)}


@app.get("/dashboard_stats")
async def dashboard_stats():
    """Aggregate statistics for the teacher dashboard."""
    db = await get_database()
    total_sessions  = await db.sessions.count_documents({})
    flagged         = await db.sessions.count_documents({"cheat_score": {"$gte": 15}})
    total_events    = await db.cheating_logs.count_documents({})

    # Average cheat score
    pipeline = [{"$group": {"_id": None, "avg": {"$avg": "$cheat_score"}}}]
    avg_result = await db.sessions.aggregate(pipeline).to_list(1)
    avg_score  = round(avg_result[0]["avg"], 1) if avg_result else 0

    # Recent sessions
    recent = await db.sessions.find({}).sort("start_time", -1).to_list(10)
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
# WebSocket Endpoint
# ══════════════════════════════════════════════════════════════

@app.websocket("/ws/exam/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket connection for real-time event streaming.
    The frontend connects here to receive live cheating alerts.
    """
    await websocket.accept()

    # Register connection
    if session_id not in active_connections:
        active_connections[session_id] = []
    active_connections[session_id].append(websocket)

    # Send initial status
    await websocket.send_json({
        "type": "connected",
        "session_id": session_id,
        "message": "Niriksha monitoring active",
        "face_status": "Initializing detectors...",
    })

    try:
        while True:
            # Keep connection alive, receive any client messages
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                # Handle ping from client
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                # Handle tab_switch reported by JS
                elif msg.get("type") == "browser_event":
                    event_type = msg.get("event")
                    score_engine.add_events(session_id, [{"type": event_type, "score": 10}])
                    total = score_engine.get_score(session_id)
                    await broadcast(session_id, {
                        "type": "browser_cheat",
                        "event": event_type,
                        "message": msg.get("message", event_type),
                        "cheat_score": total,
                        "flagged": total >= 15,
                    })
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        active_connections[session_id].remove(websocket)
        print(f"[WS] Client disconnected: {session_id}")
