"""
Cheating Score Engine
=====================
Rule-based scoring system that:
  1. Accumulates weighted scores per detection event per session.
  2. Flags a student when total score exceeds CHEAT_THRESHOLD (15).
  3. Persists score state in a per-session dict (in-memory).

Score weights:
  look_left        → +2
  look_right       → +2
  look_down        → +3
  head_left        → +2
  head_right       → +2
  head_down        → +3
  face_missing     → +5
  phone_detected   → +10
  multiple_faces   → +10
  tab_switch       → +10
  talking          → +3
  suspicious_hand  → +2

Threshold: score >= 15 → flagged
"""
from typing import List
import time

# ── Score rule weights ──
SCORE_WEIGHTS = {
    "look_left":       2,
    "look_right":      2,
    "look_down":       3,
    "head_left":       2,
    "head_right":      2,
    "head_down":       3,
    "face_missing":    5,
    "phone_detected":  10,
    "multiple_faces":  10,
    "tab_switch":      10,
    "talking":         3,
    "suspicious_hand": 2,
}

CHEAT_THRESHOLD = 15


class CheatingScoreEngine:
    """
    Maintains per-session cheating scores in memory.
    Thread-safe enough for single-server async usage.
    """

    def __init__(self):
        # {session_id: {"score": float, "events": list, "flagged": bool}}
        self._sessions: dict = {}

    def reset(self, session_id: str):
        """Initialize (or reset) a session."""
        self._sessions[session_id] = {
            "score":   0.0,
            "events":  [],
            "flagged": False,
        }

    def _ensure_session(self, session_id: str):
        if session_id not in self._sessions:
            self.reset(session_id)

    def add_events(self, session_id: str, events: List[dict]):
        """
        Add detection events and increment score.

        Args:
            session_id: unique session identifier.
            events: list of dicts with 'type' and optional 'score' keys.
        """
        self._ensure_session(session_id)
        sess = self._sessions[session_id]

        for event in events:
            event_type = event.get("type", "")
            # Use event-defined score if present, else look up in weights table
            weight = event.get("score") or SCORE_WEIGHTS.get(event_type, 1)
            sess["score"] += weight
            sess["events"].append({
                **event,
                "timestamp": time.time(),
                "weight_applied": weight,
            })

        # Check threshold
        if sess["score"] >= CHEAT_THRESHOLD:
            sess["flagged"] = True

    def get_score(self, session_id: str) -> float:
        """Return current cumulative cheating score."""
        self._ensure_session(session_id)
        return self._sessions[session_id]["score"]

    def is_flagged(self, session_id: str) -> bool:
        """Return whether the session has been flagged."""
        self._ensure_session(session_id)
        return self._sessions[session_id]["flagged"]

    def get_events(self, session_id: str) -> list:
        """Return all recorded events for a session."""
        self._ensure_session(session_id)
        return self._sessions[session_id]["events"]

    def get_all_sessions(self) -> dict:
        """Return the full sessions dict (for dashboard aggregation)."""
        return dict(self._sessions)
