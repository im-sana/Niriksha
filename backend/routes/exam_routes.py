"""
Niriksha — Exam Routes (JWT Protected)
=========================================
Protected versions of the core exam endpoints.
All existing AI detection logic is unchanged; these routes just add
JWT authentication, result persistence, and screenshot capture.

Endpoints:
  POST /exam/start          — Start an exam session
  POST /exam/submit         — Submit exam and save result
  POST /exam/analyze_frame  — Frame analysis (rate-limited, JWT protected)
  GET  /exam/result/{id}    — Get persistent result by session or result ID
  GET  /exam/my-results     — Get all results for logged-in student
"""
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from bson import ObjectId

from middleware.auth_middleware import get_current_user, require_student
from services.exam_service import (
    save_exam_result, get_result_by_session, get_results_for_user
)
from database.connection import get_database
from utils.screenshot import save_screenshot, should_capture
from utils.rate_limiter import limiter

router = APIRouter(prefix="/exam", tags=["Exam"])


# ── Schemas ───────────────────────────────────────────────────

class StartExamRequest(BaseModel):
    exam_id:      str
    student_name: Optional[str] = None  # Falls back to name from JWT


class SubmitExamRequest(BaseModel):
    session_id:      str
    answers:         dict
    cheat_score:     float
    exam_score:      int
    total_questions: int


class FrameAnalysisRequest(BaseModel):
    session_id: str
    frame_b64:  str  # base64-encoded JPEG


# ── Route Handlers ─────────────────────────────────────────────

@router.post("/start")
async def start_exam(
    req: StartExamRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Initialize a new exam session for the authenticated student.
    Creates session record in MongoDB with status='active'.
    """
    db = await get_database()

    student_name = req.student_name or current_user.get("name", "Student")
    student_id   = current_user["id"]

    session = {
        "student_id":   student_id,
        "student_name": student_name,
        "student_email":current_user.get("email", ""),
        "exam_id":      req.exam_id,
        "start_time":   datetime.utcnow().isoformat(),
        "cheat_score":  0,
        "events":       [],
        "status":       "active",
    }
    result = await db.sessions.insert_one(session)
    session_id = str(result.inserted_id)

    return {
        "session_id":  session_id,
        "message":     f"Exam session started for {student_name}",
        "student_id":  student_id,
        "exam_id":     req.exam_id,
    }


@router.post("/submit")
async def submit_exam(
    req: SubmitExamRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Submit exam and persist final result to MongoDB.
    
    - Saves ExamResult document with user_id, score, cheat_score, risk level
    - Updates session status to 'submitted'
    - Data persists across page refreshes
    """
    result_doc = await save_exam_result(
        user_id         = current_user["id"],
        session_id      = req.session_id,
        exam_score      = req.exam_score,
        total_questions = req.total_questions,
        cheat_score     = req.cheat_score,
        answers         = req.answers,
    )

    return {
        "message":    "Exam submitted successfully",
        "result_id":  result_doc["id"],
        "session_id": req.session_id,
        "flagged":    result_doc["flagged"],
        "risk_level": result_doc["risk_level"],
    }


@router.post("/analyze_frame")
@limiter.limit("2/second")
async def analyze_frame_protected(
    request: Request,
    req: FrameAnalysisRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    JWT-protected version of /analyze_frame.
    Rate limited to 2 req/s per IP.
    
    This endpoint delegates all AI processing to the app.py core function
    (imported to avoid code duplication) and adds:
      - Screenshot capture on HIGH risk events
      - Returns the same JSON as the base analyze_frame endpoint
    """
    # Delegate to the core detection logic (defined in app.py, imported here)
    import base64
    import cv2
    import numpy as np
    from app import (
        face_detector, face_mesh, eye_detector, head_estimator,
        multi_face, phone_detector, hand_detector, talk_detector,
        score_engine, broadcast,
    )

    try:
        img_bytes = base64.b64decode(req.frame_b64)
        nparr     = np.frombuffer(img_bytes, np.uint8)
        frame     = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Could not decode image")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid frame: {e}")

    results = {}
    events  = []

    # ── Detection pipeline (unchanged from app.py) ──────────────
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

    # ── Score + flag ──────────────────────────────────────────────
    score_engine.add_events(req.session_id, events)
    total_score = score_engine.get_score(req.session_id)
    flagged     = total_score >= 15

    # ── Save events + screenshot metadata to MongoDB ───────────────
    db = await get_database()

    try:
        if events:
            await db.cheating_logs.insert_many([
                {**e, "session_id": req.session_id, "user_id": current_user["id"], "timestamp": datetime.utcnow().isoformat()}
                for e in events
            ])
    except Exception:
        pass

    # ── Screenshot capture on HIGH risk ──────────────────────────
    if flagged:
        for event in events:
            if should_capture(event.get("type", "")):
                screenshot_rel = save_screenshot(req.frame_b64, current_user["id"], event["type"])

                # Keep latest screenshot on the session doc so submit can copy it to result.
                if screenshot_rel and ObjectId.is_valid(req.session_id):
                    await db.sessions.update_one(
                        {"_id": ObjectId(req.session_id)},
                        {"$set": {
                            "screenshot_path": screenshot_rel,
                            "screenshot_captured_at": datetime.utcnow().isoformat(),
                        }},
                    )
                break  # One screenshot per frame is enough

    # ── WebSocket broadcast ───────────────────────────────────────
    if events:
        await broadcast(req.session_id, {
            "type":        "detection_update",
            "events":      events,
            "cheat_score": total_score,
            "flagged":     flagged,
            "face_status": "Face Detected" if results.get("face_present") else "Face Missing",
        })

    return {
        "events":      events,
        "cheat_score": total_score,
        "flagged":     flagged,
        "results":     results,
    }


@router.get("/result/{session_id}")
async def get_result(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Fetch persistent exam result by session_id.
    Students can only see their own results; admins can see any.
    """
    result = await get_result_by_session(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Result not found.")

    # Students can only access their own results
    if current_user["role"] == "student" and result.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")

    result.pop("answers", None)  # Don't expose answer data via student API
    return result


@router.get("/my-results")
async def my_results(current_user: dict = Depends(get_current_user)):
    """Get all exam results for the currently logged-in student."""
    results = await get_results_for_user(current_user["id"])
    for r in results:
        r.pop("answers", None)
    return {"results": results, "total": len(results)}
