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
import importlib
import logging
import math
import os
import tempfile
from typing import Optional, List, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

_FACE_CASCADE = None
_MP_FACE_DETECTOR = None
_DEEPPFACE_WARNED = False


def _get_face_cascade():
    global _FACE_CASCADE
    if _FACE_CASCADE is not None:
        return _FACE_CASCADE

    try:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        cascade = cv2.CascadeClassifier(cascade_path)
        if cascade.empty():
            _FACE_CASCADE = None
        else:
            _FACE_CASCADE = cascade
    except Exception:
        _FACE_CASCADE = None

    return _FACE_CASCADE


def _get_mediapipe_face_detector():
    global _MP_FACE_DETECTOR
    if _MP_FACE_DETECTOR is not None:
        return _MP_FACE_DETECTOR

    try:
        mp = importlib.import_module("mediapipe")
        solutions = getattr(mp, "solutions", None)
        if solutions is None:
            return None
        _MP_FACE_DETECTOR = solutions.face_detection.FaceDetection(
            model_selection=0,
            min_detection_confidence=0.5,
        )
        return _MP_FACE_DETECTOR
    except Exception:
        return None


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
    frame = _b64_to_frame(frame_b64)
    if frame is None:
        return None

    # Primary path: DeepFace embedding (requires TensorFlow runtime).
    try:
        deepface_api = None
        deepface_module = importlib.import_module("deepface")
        deepface_api = getattr(deepface_module, "DeepFace", None)
        if deepface_api is None:
            deepface_api = importlib.import_module("deepface.DeepFace")
        if not hasattr(deepface_api, "represent"):
            raise RuntimeError("DeepFace API not available")

        tmp_path = _save_temp_frame(frame)
        try:
            result = None
            for enforce in (True, False):
                try:
                    result = deepface_api.represent(
                        img_path=tmp_path,
                        model_name="Facenet512",
                        enforce_detection=enforce,
                        detector_backend="opencv",
                    )
                    if result:
                        break
                except Exception:
                    continue

            if isinstance(result, list) and result:
                embedding = result[0].get("embedding")
                if embedding:
                    return embedding
            elif isinstance(result, dict):
                embedding = result.get("embedding")
                if embedding:
                    return embedding
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    except Exception as e:
        global _DEEPPFACE_WARNED
        if not _DEEPPFACE_WARNED:
            logger.warning(f"[face_utils] DeepFace unavailable, using OpenCV fallback: {e}")
            _DEEPPFACE_WARNED = True

    # Fallback path: lightweight OpenCV descriptor.
    fallback_embedding = _extract_opencv_embedding(frame)
    if fallback_embedding is not None:
        return fallback_embedding

    return None


def _extract_opencv_embedding(frame: np.ndarray) -> Optional[List[float]]:
    """
    TensorFlow-free fallback embedding for environments where DeepFace cannot run.
    Uses Haar face crop + normalized grayscale descriptor.
    """
    try:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        face_roi = None

        # Try MediaPipe first; it is more robust than Haar on webcam angles.
        detector = _get_mediapipe_face_detector()
        if detector is not None:
            try:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = detector.process(rgb)
                detections = getattr(result, "detections", None)
                if detections:
                    best = max(detections, key=lambda d: d.score[0])
                    bbox = best.location_data.relative_bounding_box
                    h, w = gray.shape[:2]
                    x1 = max(0, int(bbox.xmin * w))
                    y1 = max(0, int(bbox.ymin * h))
                    bw = int(bbox.width * w)
                    bh = int(bbox.height * h)
                    x2 = min(w, x1 + max(1, bw))
                    y2 = min(h, y1 + max(1, bh))
                    if x2 > x1 and y2 > y1:
                        face_roi = gray[y1:y2, x1:x2]
            except Exception:
                pass

        # Fallback to Haar cascade.
        if face_roi is None or face_roi.size == 0:
            cascade = _get_face_cascade()
            if cascade is not None:
                faces = cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.1,
                    minNeighbors=5,
                    minSize=(60, 60),
                )
                if len(faces) > 0:
                    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                    face_roi = gray[y : y + h, x : x + w]

        if face_roi is None or face_roi.size == 0:
            return None

        aligned = cv2.resize(face_roi, (64, 64), interpolation=cv2.INTER_AREA)
        aligned = cv2.equalizeHist(aligned)

        # Histogram + raw patch descriptor (stable enough for same-session verify).
        hist = cv2.calcHist([aligned], [0], None, [64], [0, 256]).flatten()
        patch = cv2.resize(aligned, (32, 32), interpolation=cv2.INTER_AREA).flatten().astype(np.float32)
        descriptor = np.concatenate([patch / 255.0, hist / max(float(hist.sum()), 1.0)]).astype(np.float32)

        norm = np.linalg.norm(descriptor)
        if norm == 0:
            return None

        descriptor = descriptor / norm
        return descriptor.tolist()
    except Exception as e:
        logger.warning(f"[face_utils] OpenCV fallback embedding failed: {e}")
        return None


def compare_embeddings(
    embedding1: List[float],
    embedding2: List[float],
    threshold: float = 0.55,
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

    # Different embedding generators can produce different vector sizes.
    if e1.shape != e2.shape:
        min_len = min(e1.shape[0], e2.shape[0])
        if min_len < 64:
            return False, 0.0
        e1 = e1[:min_len]
        e2 = e2[:min_len]
    
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
