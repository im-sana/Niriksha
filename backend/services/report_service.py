"""
Niriksha — Report Service Layer
==================================
Orchestrates Claude AI report generation for the teacher dashboard.
Handles:
  - Generating reports on-demand (with caching)
  - Aggregating dashboard statistics
  - Building filtered/sorted result lists for admin view
"""
import logging
from typing import Optional, List

from database.connection import get_database
from utils.claude_client import generate_exam_report, smart_alert
from services.exam_service import get_cheating_events, cache_claude_report

logger = logging.getLogger(__name__)


def _normalize_report_labels(report_text: str) -> str:
    """Keep report wording consistent across cached and fresh reports."""
    return (
        report_text
        .replace("Integrity Risk Score", "Cheating Score")
        .replace("Integrity Score", "Cheating Score")
    )


async def get_or_generate_report(result_id: str) -> str:
    """
    Return the cached Claude report for a result, or generate it now.

    Generation is triggered on first request and the result is cached
    in the document to avoid repeated API calls.

    Args:
        result_id: MongoDB _id string of the result document

    Returns:
        Markdown-formatted report string
    """
    from bson import ObjectId
    db = await get_database()

    # Fetch the result doc
    result = await db.results.find_one({"_id": ObjectId(result_id)})
    if not result:
        return "Result not found."

    # Return cached report if already generated
    if result.get("claude_report"):
        normalized_cached = _normalize_report_labels(result["claude_report"])
        if normalized_cached != result["claude_report"]:
            await cache_claude_report(result_id, normalized_cached)
        return normalized_cached

    # Gather events for this session
    events = await get_cheating_events(result.get("session_id", ""))

    # Call Claude
    report = generate_exam_report(
        student_name    = result.get("user_name", "Unknown Student"),
        exam_score      = result.get("exam_score", 0),
        total_questions = result.get("total_questions", 1),
        cheat_score     = result.get("cheat_score", 0),
        risk_level      = result.get("risk_level", "Low"),
        flagged         = result.get("flagged", False),
        events          = events,
    )

    normalized_report = _normalize_report_labels(report)

    # Cache for future requests
    await cache_claude_report(result_id, normalized_report)
    return normalized_report


async def get_dashboard_stats() -> dict:
    """
    Compute aggregate stats for the teacher dashboard overview cards.

    Returns:
        Dict with total_students, total_exams, flagged_count,
        avg_cheat_score, risk level counts.
    """
    db = await get_database()

    total_results   = await db.results.count_documents({})
    flagged_count   = await db.results.count_documents({"flagged": True})
    high_risk       = await db.results.count_documents({"risk_level": "High"})
    medium_risk     = await db.results.count_documents({"risk_level": "Medium"})
    low_risk        = await db.results.count_documents({"risk_level": "Low"})
    total_users     = await db.users.count_documents({"role": "student"})

    # Average cheat score
    pipeline = [{"$group": {"_id": None, "avg": {"$avg": "$cheat_score"}}}]
    avg_result = await db.results.aggregate(pipeline).to_list(1)
    avg_score  = round(avg_result[0]["avg"], 1) if avg_result else 0.0

    return {
        "total_students":    total_users,
        "total_exams":       total_results,
        "flagged_count":     flagged_count,
        "avg_cheat_score":   avg_score,
        "high_risk_count":   high_risk,
        "medium_risk_count": medium_risk,
        "low_risk_count":    low_risk,
    }


async def get_all_results(
    search: Optional[str] = None,
    risk_filter: Optional[str] = None,
    sort_by: str = "timestamp",
    sort_order: int = -1,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """
    Fetch all exam results for the admin dashboard with filtering and sorting.

    Args:
        search:      Name or email substring to search for
        risk_filter: "Low" | "Medium" | "High" | None
        sort_by:     Field to sort by ("timestamp", "cheat_score", "exam_score")
        sort_order:  1 = ascending, -1 = descending
        page:        Page number (1-indexed)
        page_size:   Results per page

    Returns:
        {"results": [...], "total": int, "page": int, "pages": int}
    """
    db = await get_database()

    query = {}

    # Search by name or email
    if search:
        import re
        pattern = re.compile(re.escape(search), re.IGNORECASE)
        query["$or"] = [
            {"user_name":  {"$regex": pattern}},
            {"user_email": {"$regex": pattern}},
        ]

    # Filter by risk level
    if risk_filter and risk_filter in ("Low", "Medium", "High"):
        query["risk_level"] = risk_filter

    # Validate sort field
    allowed_sort = {"timestamp", "cheat_score", "exam_score", "risk_level"}
    if sort_by not in allowed_sort:
        sort_by = "timestamp"

    # Total count for pagination
    total = await db.results.count_documents(query)
    pages = max(1, (total + page_size - 1) // page_size)
    skip  = (page - 1) * page_size

    cursor = (
        db.results.find(query)
        .sort(sort_by, sort_order)
        .skip(skip)
        .limit(page_size)
    )
    results = await cursor.to_list(page_size)

    # Serialize ObjectIds
    for r in results:
        r["id"] = str(r.pop("_id"))
        r.pop("answers", None)       # Don't leak answer data to dashboard
        r.pop("claude_report", None) # Load on demand via separate endpoint

    return {
        "results":  results,
        "total":    total,
        "page":     page,
        "pages":    pages,
    }
