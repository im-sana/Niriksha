"""
Niriksha — Result Pydantic Models
===================================
Defines schemas for exam results, Claude reports, and cheating logs.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime


# ── Enums ─────────────────────────────────────────────────────

class RiskLevel:
    LOW    = "Low"
    MEDIUM = "Medium"
    HIGH   = "High"

    @staticmethod
    def from_score(score: float) -> str:
        """Derive risk level from cheat score."""
        if score < 10:
            return RiskLevel.LOW
        elif score < 20:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.HIGH


# ── Request schemas ───────────────────────────────────────────

class SaveResultRequest(BaseModel):
    """Used internally when an exam is submitted."""
    user_id: str
    session_id: str
    exam_score: int           # correct answers count
    total_questions: int
    cheat_score: float
    answers: Dict[str, Any]   # {question_index: selected_option}


# ── Response schemas ──────────────────────────────────────────

class ExamResult(BaseModel):
    """Full exam result record."""
    id: str
    user_id: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    session_id: str
    exam_score: int
    total_questions: int
    cheat_score: float
    risk_level: str
    flagged: bool
    timestamp: str
    screenshot_path: Optional[str] = None
    claude_report: Optional[str] = None   # cached Claude markdown
    events_summary: Optional[List[str]] = None

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    """Aggregate stats for teacher dashboard."""
    total_students: int
    total_exams: int
    flagged_count: int
    avg_cheat_score: float
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
