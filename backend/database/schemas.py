"""
MongoDB Document Schemas
=========================
Defines dataclass-style schemas for documents stored in MongoDB.
These are documentation/validation helpers; Motor itself is schema-less.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict


@dataclass
class StudentDocument:
    """Represents a student record in the `students` collection."""
    student_id:   str
    name:         str
    email:        str
    exam_id:      str
    enrolled:     bool = True
    created_at:   str  = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class ExamDocument:
    """Represents an exam configuration in the `exams` collection."""
    exam_id:      str
    title:        str
    subject:      str
    duration_min: int
    questions:    int
    active:       bool = False
    created_at:   str  = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class SessionDocument:
    """Represents an active / completed exam session in `sessions`."""
    student_id:   str
    exam_id:      str
    student_name: str
    start_time:   str
    end_time:     Optional[str] = None
    cheat_score:  float        = 0.0
    events:       List[dict]   = field(default_factory=list)
    answers:      Dict         = field(default_factory=dict)
    status:       str          = "active"   # active | submitted | flagged


@dataclass
class CheatingLogDocument:
    """A single cheating detection event stored in `cheating_logs`."""
    session_id:  str
    student_id:  str
    event_type:  str        # face_missing | phone_detected | tab_switch | etc.
    message:     str
    score_delta: float
    timestamp:   str = field(default_factory=lambda: datetime.utcnow().isoformat())
    snapshot_b64: Optional[str] = None  # base64 frame snapshot for evidence
