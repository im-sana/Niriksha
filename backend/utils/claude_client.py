"""
Niriksha — Anthropic Claude AI Integration
===========================================
Provides three AI-powered features:
  A. Incident Explainer — human-readable explanation of detection events
  B. Post-Exam Report   — full behavior analysis report (markdown)
  C. Smart Alert        — convert raw event type to readable alert message

Graceful fallback if ANTHROPIC_API_KEY is missing or API call fails.
"""
import logging
import os
from typing import List, Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = "claude-sonnet-4-5"  # Use latest claude sonnet


def _get_client():
    """Lazily init Anthropic client (only if API key is available)."""
    if not ANTHROPIC_API_KEY or ANTHROPIC_API_KEY == "your_anthropic_api_key_here":
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    except ImportError:
        logger.warning("[claude] anthropic package not installed")
        return None


def _call_claude(prompt: str, max_tokens: int = 800) -> Optional[str]:
    """
    Send a prompt to Claude and return the response text.
    Returns None on failure (caller should use fallback).
    """
    client = _get_client()
    if client is None:
        return None

    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text
    except Exception as e:
        logger.error(f"[claude] API call failed: {e}")
        return None


# ═══════════════════════════════════════════════════════════════
# A. Incident Explainer
# ═══════════════════════════════════════════════════════════════

def explain_incident(events: List[dict]) -> str:
    """
    Convert a list of raw detection events into a simple human-readable
    explanation suitable for showing in the dashboard alert feed.

    Args:
        events: list of event dicts with 'type', 'message', 'score' keys
    Returns:
        Human-readable explanation string
    """
    if not events:
        return "No suspicious activity detected in this frame."

    event_list = ", ".join(e.get("message", e.get("type", "unknown")) for e in events)
    prompt = f"""You are an AI exam proctor assistant. Briefly explain these detected events 
during an online exam in 1-2 plain English sentences. Be concise and professional.

Detected events: {event_list}

Provide a brief, professional explanation (max 50 words):"""

    result = _call_claude(prompt, max_tokens=100)
    if result:
        return result.strip()

    # Fallback: static summary
    return f"Suspicious behavior detected: {event_list}. This has been logged and added to the student's risk score."


# ═══════════════════════════════════════════════════════════════
# B. Post-Exam Report Generator
# ═══════════════════════════════════════════════════════════════

def generate_exam_report(
    student_name: str,
    exam_score: int,
    total_questions: int,
    cheat_score: float,
    risk_level: str,
    flagged: bool,
    events: List[dict],
    session_duration_min: Optional[int] = None,
) -> str:
    """
    Generate a comprehensive post-exam report for a student using Claude.

    Returns:
        Markdown-formatted report string.
    """
    event_types = {}
    for e in events:
        t = e.get("type", "unknown")
        event_types[t] = event_types.get(t, 0) + 1

    event_summary = "\n".join(
        f"  - {etype}: {count} occurrence(s)" for etype, count in event_types.items()
    ) or "  - No events recorded"

    duration_text = f"{session_duration_min} minutes" if session_duration_min else "Unknown"
    pct = round((exam_score / total_questions) * 100) if total_questions else 0

    prompt = f"""You are an AI exam integrity analyst for "Niriksha" — an AI-powered exam proctoring system.
Generate a professional post-exam report in Markdown format for the following student:

Student: {student_name}
Exam Score: {exam_score}/{total_questions} ({pct}%)
Exam Duration: {duration_text}
Integrity Risk Score: {cheat_score}
Risk Level: {risk_level}
Flagged for Review: {"Yes" if flagged else "No"}

Detected Behavioral Events:
{event_summary}

Generate a report with these sections:
1. ## Executive Summary (2-3 sentences)
2. ## Behavioral Analysis (bullet points analyzing each event type)
3. ## Risk Assessment (explain the risk level and what it means)
4. ## Recommendation (action to take: pass/review/investigate)

Keep it professional, factual, and concise (max 300 words). Use markdown formatting."""

    result = _call_claude(prompt, max_tokens=600)
    if result:
        return result.strip()

    # Fallback static report
    return f"""## Exam Report — {student_name}

**Exam Score:** {exam_score}/{total_questions} ({pct}%)  
**Risk Level:** {risk_level}  
**Integrity Score:** {cheat_score}  
**Flagged:** {"Yes" if flagged else "No"}

## Behavioral Analysis
{event_summary if event_summary else "No events detected."}

## Risk Assessment
{'This student has been flagged for potential academic dishonesty based on the detected behavioral events.' if flagged else 'No major integrity violations were detected during this exam session.'}

## Recommendation
{'Manual review recommended by the exam administrator.' if flagged else 'No action required. Student passed integrity checks.'}

*Report generated by Niriksha AI System*"""


# ═══════════════════════════════════════════════════════════════
# C. Smart Alert Messages
# ═══════════════════════════════════════════════════════════════

def smart_alert(
    event_type: str,
    student_name: str = "Student",
    context: Optional[str] = None,
) -> str:
    """
    Convert a raw detection event type into a readable, context-aware
    alert message for the teacher dashboard.

    Args:
        event_type: e.g. "phone_detected", "tab_switch", "multiple_faces"
        student_name: Name of the student
        context: Optional additional context
    Returns:
        Human-readable alert string
    """
    # Static fallback map (used if API unavailable or for speed)
    STATIC_ALERTS = {
        "phone_detected":   f"📱 {student_name}: Mobile phone detected in camera view",
        "multiple_faces":   f"👥 {student_name}: Multiple people detected in frame",
        "tab_switch":       f"🔄 {student_name}: Switched browser tabs or left exam window",
        "face_missing":     f"👤 {student_name}: Face not visible — student may have left",
        "look_left":        f"👁 {student_name}: Sustained gaze to the left detected",
        "look_right":       f"👁 {student_name}: Sustained gaze to the right detected",
        "look_down":        f"👁 {student_name}: Looking down — possible reference material",
        "head_left":        f"🔍 {student_name}: Head turned left",
        "head_right":       f"🔍 {student_name}: Head turned right",
        "head_down":        f"🔍 {student_name}: Head turned down",
        "talking":          f"🗣 {student_name}: Possible talking detected",
        "suspicious_hand":  f"✋ {student_name}: Suspicious hand movement detected",
        "fullscreen_exit":  f"🖥 {student_name}: Exited fullscreen mode",
        "copy_attempt":     f"📋 {student_name}: Copy/paste shortcut detected",
    }

    return STATIC_ALERTS.get(event_type, f"⚠️ {student_name}: {event_type.replace('_', ' ').title()} detected")
