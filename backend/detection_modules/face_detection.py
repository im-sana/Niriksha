"""
Face Detection Module — MediaPipe Face Detection
=================================================
Uses MediaPipe Face Detection to determine if a face is present in the frame.
Detection confidence threshold: 0.5
"""
from dataclasses import dataclass
from typing import Optional
import numpy as np

try:
    import mediapipe as mp
    import cv2
    MP_AVAILABLE = True
except ImportError:
    MP_AVAILABLE = False


@dataclass
class FaceDetectionResult:
    face_present: bool
    confidence:   float = 0.0
    bbox:         Optional[tuple] = None  # (x, y, w, h) normalized


class FaceDetector:
    """
    Wraps MediaPipe Face Detection.
    Detects whether at least one face is present with sufficient confidence.
    """
    CONFIDENCE_THRESHOLD = 0.5

    def __init__(self):
        self._detector = None
        if MP_AVAILABLE:
            self._mp_face      = mp.solutions.face_detection
            self._detector     = self._mp_face.FaceDetection(
                model_selection=0,
                min_detection_confidence=self.CONFIDENCE_THRESHOLD,
            )

    def detect(self, frame: np.ndarray) -> FaceDetectionResult:
        """
        Args:
            frame: BGR numpy array from OpenCV.
        Returns:
            FaceDetectionResult with face_present flag and bounding box.
        """
        if not MP_AVAILABLE or self._detector is None:
            # Mock result when MediaPipe not installed
            return FaceDetectionResult(face_present=True, confidence=0.99)

        rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = self._detector.process(rgb)

        if result.detections:
            best = max(result.detections, key=lambda d: d.score[0])
            bbox = best.location_data.relative_bounding_box
            return FaceDetectionResult(
                face_present=True,
                confidence=best.score[0],
                bbox=(bbox.xmin, bbox.ymin, bbox.width, bbox.height),
            )

        return FaceDetectionResult(face_present=False, confidence=0.0)
