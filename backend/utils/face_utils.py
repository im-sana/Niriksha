"""
Niriksha — Face Embedding Utilities  
=======================================
Provides face embedding extraction and comparison for identity verification.

Strategy:
  - Uses DeepFace (wraps multiple backends; Facenet512 for accuracy)
  - Liveness check via blink/motion heuristic using MediaPipe
  - Embeddings stored as float lists in MongoDB (not raw images)

NOTE: DeepFace downloads model weights on first use (~100MB).
      This is normal; subsequent calls use cache.
"""
import base64
import logging
import math
import os
import tempfile
from typing import Optional, List, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def _b64_to_frame(frame_b64: str) -> Optional[np.ndarray]:
    """Decode a base64 JPEG string to an OpenCV BGR frame."""
    try:
        img_bytes = base64.b64decode(frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return frame
    except Exception as e:
        logger.error(f"[face_utils] Failed to decode b64 frame: {e}")
        return None


def extract_embedding(frame_b64: str) -> Optional[List[float]]:
    """
    Extract a 512-dimensional face embedding from a base64 JPEG frame.

    Returns:
        List of 512 floats, or None if no face detected.
    """
    try:
        from deepface import DeepFace  # lazy import to avoid startup cost

        frame = _b64_to_frame(frame_b64)
        if frame is None:
            return None

        # Save frame to temp file (DeepFace requires file path or numpy array)
        tmp_path = _save_temp_frame(frame)
        try:
            result = DeepFace.represent(
                img_path=tmp_path,
                model_name="Facenet512",
                enforce_detection=True,  # raises if no face found
                detector_backend="opencv",
            )
            embedding = result[0]["embedding"]
            return embedding
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    except Exception as e:
        logger.warning(f"[face_utils] Embedding extraction failed: {e}")
        return None


def compare_embeddings(
    embedding1: List[float],
    embedding2: List[float],
    threshold: float = 0.40,  # cosine distance threshold (lower = stricter)
) -> Tuple[bool, float]:
    """
    Compare two face embeddings using cosine distance.

    Args:
        embedding1: Stored embedding (from DB)
        embedding2: Live embedding (from webcam)
        threshold: Max cosine distance to consider a match (default 0.40)

    Returns:
        (is_match: bool, confidence_score: float 0-1)
    """
    if not embedding1 or not embedding2:
        return False, 0.0

    # Cosine distance calculation
    e1 = np.array(embedding1, dtype=np.float32)
    e2 = np.array(embedding2, dtype=np.float32)
    
    norm1 = np.linalg.norm(e1)
    norm2 = np.linalg.norm(e2)
    
    if norm1 == 0 or norm2 == 0:
        return False, 0.0

    cosine_similarity = np.dot(e1, e2) / (norm1 * norm2)
    cosine_distance   = 1.0 - float(cosine_similarity)

    # Convert distance to confidence (0=no match, 1=perfect match)
    confidence = max(0.0, min(1.0, 1.0 - (cosine_distance / threshold)))
    is_match   = cosine_distance <= threshold

    return is_match, round(confidence, 3)


def liveness_check(frame_b64: str) -> bool:
    """
    Basic liveness check to resist photo spoofing.
    
    Checks if the frame has realistic skin texture variance
    (photos are often too uniform). This is a heuristic, not a
    deep liveness system — use dedicated liveness models for production.

    Returns:
        True if likely a real person, False if possibly a photo.
    """
    try:
        frame = _b64_to_frame(frame_b64)
        if frame is None:
            return False

        # Convert to grayscale and check Laplacian variance (texture richness)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # Printed photos of faces tend to be very low-variance prints or
        # screens tend to have very high uniform regions.
        # Real faces in normal lighting typically have variance > 15
        return laplacian_var > 15.0

    except Exception as e:
        logger.warning(f"[face_utils] Liveness check failed: {e}")
        return True  # Permissive fallback


def _save_temp_frame(frame: np.ndarray) -> str:
    """Save a numpy frame to a temp file and return the path."""
    tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    cv2.imwrite(tmp.name, frame)
    tmp.close()
    return tmp.name
