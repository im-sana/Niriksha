"""
Niriksha — Exam Service Layer
================================
Business logic for exam session management and result persistence.
All interactions with MongoDB go through here (not inside route handlers).
"""
import logging
from datetime import datetime
from typing import Optional, List

from database.connection import get_database
from models.result import RiskLevel

logger = logging.getLogger(__name__)


async def save_exam_result(
    user_id: str,
    session_id: str,
    exam_score: int,
    total_questions: int,
    cheat_score: float,
    answers: dict,
) -> dict:
    """
    Persist the final exam result to the MongoDB `results` collection.

    Calculates risk level from cheat score, marks flagged status,
    and updates the session document as 'submitted'.

    Returns:
        The saved result document (as dict, with string _id).
    """
    db = await get_database()

    risk_level = RiskLevel.from_score(cheat_score)
    flagged    = cheat_score >= 15

    # Fetch user info for denormalized storage (faster dashboard queries)
    from bson import ObjectId
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"name": 1, "email": 1})
    user_name  = user.get("name", "Unknown")  if user else "Unknown"
    user_email = user.get("email", "")        if user else ""

    # Pull latest screenshot path from the session so dashboard can open it later.
    session_query = {"_id": ObjectId(session_id)} if ObjectId.is_valid(session_id) else {"student_id": user_id, "status": "active"}
    session_doc = await db.sessions.find_one(session_query, {"screenshot_path": 1})
    screenshot_path = session_doc.get("screenshot_path") if session_doc else None

    result_doc = {
        "user_id":         user_id,
        "user_name":       user_name,
        "user_email":      user_email,
        "session_id":      session_id,
        "exam_score":      exam_score,
        "total_questions": total_questions,
        "cheat_score":     cheat_score,
        "risk_level":      risk_level,
        "flagged":         flagged,
        "answers":         answers,
        "timestamp":       datetime.utcnow().isoformat(),
        "screenshot_path": screenshot_path,
        "claude_report":   None,          # Generated on demand
    }

    insert_result = await db.results.insert_one(result_doc)
    result_doc["_id"] = str(insert_result.inserted_id)
    result_doc["id"]  = result_doc["_id"]

    # Update session status to 'submitted'
    await db.sessions.update_one(
        session_query,
        {"$set": {
            "status":      "submitted",
            "cheat_score": cheat_score,
            "end_time":    datetime.utcnow().isoformat(),
        }},
    )

    logger.info(f"[exam_service] Result saved for user {user_id}, score {exam_score}/{total_questions}")
    return result_doc


async def get_result_by_session(session_id: str) -> Optional[dict]:
    """Fetch an exam result by session_id."""
    db = await get_database()
    result = await db.results.find_one({"session_id": session_id})
    if result:
        result["id"] = str(result.pop("_id"))
    return result


async def get_results_for_user(user_id: str) -> List[dict]:
    """Fetch all exam results for a specific student."""
    db = await get_database()
    cursor = db.results.find({"user_id": user_id}).sort("timestamp", -1)
    results = await cursor.to_list(100)
    for r in results:
        r["id"] = str(r.pop("_id"))
    return results


async def get_cheating_events(session_id: str) -> List[dict]:
    """Fetch all cheating events logged during a session."""
    db = await get_database()
    logs = await db.cheating_logs.find({"session_id": session_id}).sort("timestamp", 1).to_list(500)
    for log in logs:
        log["_id"] = str(log["_id"])
    return logs


async def attach_screenshot(result_id: str, screenshot_path: str) -> None:
    """Update a result record with a screenshot path."""
    from bson import ObjectId
    db = await get_database()
    await db.results.update_one(
        {"_id": ObjectId(result_id)},
        {"$set": {"screenshot_path": screenshot_path}},
    )


async def cache_claude_report(result_id: str, report_text: str) -> None:
    """Cache the Claude-generated report on the result document."""
    from bson import ObjectId
    db = await get_database()
    await db.results.update_one(
        {"_id": ObjectId(result_id)},
        {"$set": {"claude_report": report_text}},
    )
