"""
Niriksha — Screenshot Capture Utility
=======================================
Captures and saves webcam frames when HIGH risk events occur.

Storage format:
  backend/screenshots/{user_id}/{timestamp}_{event_type}.jpg

The saved path is stored in MongoDB with the exam result
so admins can view it in the dashboard.
"""
import base64
import logging
import os
from datetime import datetime

import cv2
import numpy as np
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SCREENSHOTS_DIR = os.getenv("SCREENSHOTS_DIR", "screenshots")


def save_screenshot(
    frame_b64: str,
    user_id: str,
    event_type: str,
) -> str | None:
    """
    Decode a base64 frame and save it as a JPEG screenshot.

    Args:
        frame_b64:  Base64-encoded JPEG frame string
        user_id:    Student user ID (used for folder organization)
        event_type: Type of triggering event (e.g. "phone_detected")

    Returns:
        Relative path to the saved screenshot, or None on failure.
        Path format: screenshots/{user_id}/{timestamp}_{event_type}.jpg
    """
    try:
        # Decode base64 frame
        img_bytes = base64.b64decode(frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            logger.warning(f"[screenshot] Could not decode frame for user {user_id}")
            return None

        # Build save directory
        user_dir = os.path.join(SCREENSHOTS_DIR, str(user_id))
        os.makedirs(user_dir, exist_ok=True)

        # Build filename with timestamp
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
        safe_event = event_type.replace(" ", "_").replace("/", "_")
        filename = f"{timestamp}_{safe_event}.jpg"
        filepath = os.path.join(user_dir, filename)

        # Save image
        success = cv2.imwrite(filepath, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])

        if success:
            logger.info(f"[screenshot] Saved: {filepath}")
            # Return relative path (suitable for serving via /screenshots/ endpoint)
            return os.path.join(str(user_id), filename).replace("\\", "/")
        else:
            logger.error(f"[screenshot] cv2.imwrite failed for {filepath}")
            return None

    except Exception as e:
        logger.error(f"[screenshot] Error saving screenshot: {e}")
        return None


# Events that trigger automatic screenshot capture
HIGH_RISK_EVENTS = {
    "phone_detected",
    "multiple_faces",
    "tab_switch",
    "fullscreen_exit",
    "copy_attempt",
}


def should_capture(event_type: str) -> bool:
    """Return True if this event type warrants an automatic screenshot."""
    return event_type in HIGH_RISK_EVENTS
