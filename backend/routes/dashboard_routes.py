"""
Niriksha — Dashboard Routes (Admin Only)
==========================================
All endpoints require 'admin' role JWT.

Provides:
  GET  /dashboard/stats             — Overview cards data
  GET  /dashboard/results           — All student results (search/filter/sort)
  GET  /dashboard/student/{user_id} — Single student profile + all results
  GET  /dashboard/report/{result_id}— Claude AI report for a specific result
  GET  /dashboard/screenshot/{path} — Serve captured screenshot files
"""
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse

from middleware.auth_middleware import require_admin
from services.report_service import get_dashboard_stats, get_all_results, get_or_generate_report
from services.exam_service import get_results_for_user, get_cheating_events
from database.connection import get_database
from utils.claude_client import explain_incident

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

SCREENSHOTS_DIR = os.getenv("SCREENSHOTS_DIR", "screenshots")


@router.get("/stats")
async def dashboard_stats(admin: dict = Depends(require_admin)):
    """
    Get aggregate statistics for the dashboard overview cards.
    Admin only.
    """
    return await get_dashboard_stats()


@router.get("/results")
async def all_results(
    search:     Optional[str] = Query(None, description="Search by name or email"),
    risk:       Optional[str] = Query(None, description="Filter: Low | Medium | High"),
    sort_by:    str           = Query("timestamp", description="Sort field"),
    sort_order: int           = Query(-1, description="1=asc, -1=desc"),
    page:       int           = Query(1, ge=1),
    page_size:  int           = Query(20, ge=1, le=100),
    admin: dict = Depends(require_admin),
):
    """
    List all student exam results with search, filter, and sort.
    Admin only.
    
    Query params:
      search    — name or email substring
      risk      — Low | Medium | High
      sort_by   — timestamp | cheat_score | exam_score
      sort_order— 1 or -1
      page      — page number (1-indexed)
      page_size — results per page (max 100)
    """
    return await get_all_results(
        search      = search,
        risk_filter = risk,
        sort_by     = sort_by,
        sort_order  = sort_order,
        page        = page,
        page_size   = page_size,
    )


@router.get("/student/{user_id}")
async def student_detail(user_id: str, admin: dict = Depends(require_admin)):
    """
    Get full profile and all exam results for a specific student.
    Admin only.
    """
    from bson import ObjectId
    db = await get_database()

    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0, "face_embedding": 0})
    except Exception:
        raise HTTPException(status_code=404, detail="Student not found.")

    if not user:
        raise HTTPException(status_code=404, detail="Student not found.")

    user["id"] = str(user.pop("_id"))
    results = await get_results_for_user(user_id)

    return {"student": user, "results": results, "total_exams": len(results)}


@router.get("/report/{result_id}")
async def get_report(result_id: str, admin: dict = Depends(require_admin)):
    """
    Get (or generate) the Claude AI report for a specific exam result.
    
    - Returns cached report if already generated
    - Calls Claude API to generate if not yet cached
    - Admin only
    """
    report = await get_or_generate_report(result_id)
    return {"result_id": result_id, "report": report}


@router.get("/events/{session_id}")
async def session_events(session_id: str, admin: dict = Depends(require_admin)):
    """
    Get all cheating detection events logged during a session.
    Useful for detailed behavioral review.
    Admin only.
    """
    events = await get_cheating_events(session_id)
    return {"session_id": session_id, "events": events, "total": len(events)}


@router.get("/screenshot/{user_id}/{filename}")
async def serve_screenshot(
    user_id: str,
    filename: str,
    admin: dict = Depends(require_admin),
):
    """
    Serve a captured screenshot file.
    Only admins can access screenshot files.
    """
    filepath = os.path.join(SCREENSHOTS_DIR, user_id, filename)
    
    # Security: prevent path traversal
    safe_path = os.path.abspath(filepath)
    safe_base = os.path.abspath(SCREENSHOTS_DIR)
    if not safe_path.startswith(safe_base):
        raise HTTPException(status_code=400, detail="Invalid path.")

    if not os.path.exists(safe_path):
        raise HTTPException(status_code=404, detail="Screenshot not found.")

    return FileResponse(safe_path, media_type="image/jpeg")
