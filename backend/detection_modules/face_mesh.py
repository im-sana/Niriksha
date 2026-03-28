"""
Face Mesh Module — MediaPipe Face Mesh
========================================
Extracts 468 3D facial landmarks from a webcam frame.
These landmarks are used downstream by:
  - eye_movement.py  (iris / eyelid points)
  - talking_detection.py (mouth aspect ratio)
  - head_pose.py (6-DoF reference points)
"""
from dataclasses import dataclass, field
from typing import Optional, List, Any
import numpy as np

mp = None
cv2 = None
MP_AVAILABLE = False
CV2_AVAILABLE = False

try:
    import mediapipe as mp
    if hasattr(mp, "solutions"):
        MP_AVAILABLE = True
    else:
        from mediapipe.python import solutions as mp_solutions

        class _MPShim:
            solutions = mp_solutions

        mp = _MPShim()
        MP_AVAILABLE = True
except Exception:
    MP_AVAILABLE = False

try:
    import cv2
    CV2_AVAILABLE = True
except Exception:
    CV2_AVAILABLE = False


@dataclass
class FaceMeshResult:
    landmarks: Optional[Any] = None   # mediapipe NormalizedLandmarkList
    landmark_list: List = field(default_factory=list)  # flat list of (x,y,z)


class FaceMeshAnalyzer:
    """
    Runs MediaPipe Face Mesh on a frame and returns 468 facial landmarks.
    Refine landmarks is enabled for higher-accuracy iris tracking.
    """
    def __init__(self):
        self._mesh = None
        if MP_AVAILABLE:
            try:
                self._mp_mesh = mp.solutions.face_mesh
                self._mesh = self._mp_mesh.FaceMesh(
                    static_image_mode=False,
                    max_num_faces=1,
                    refine_landmarks=True,    # includes iris landmarks (468-477)
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5,
                )
            except Exception:
                self._mesh = None

    def analyze(self, frame: np.ndarray) -> FaceMeshResult:
        """
        Args:
            frame: BGR numpy array.
        Returns:
            FaceMeshResult with MediaPipe NormalizedLandmarkList or None.
        """
        if (
            not MP_AVAILABLE
            or not CV2_AVAILABLE
            or self._mesh is None
            or frame is None
            or not isinstance(frame, np.ndarray)
            or frame.size == 0
        ):
            return FaceMeshResult(landmarks=None)

        try:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = self._mesh.process(rgb)
        except Exception:
            return FaceMeshResult(landmarks=None)

        if getattr(result, "multi_face_landmarks", None):
            lm = result.multi_face_landmarks[0]
            flat = [(p.x, p.y, p.z) for p in lm.landmark]
            return FaceMeshResult(landmarks=lm, landmark_list=flat)

        return FaceMeshResult(landmarks=None)

    def close(self):
        if self._mesh is not None and hasattr(self._mesh, "close"):
            try:
                self._mesh.close()
            except Exception:
                pass
