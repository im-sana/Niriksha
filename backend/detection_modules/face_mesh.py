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
from typing import Optional, List
import numpy as np

try:
    import mediapipe as mp
    import cv2
    MP_AVAILABLE = True
except ImportError:
    MP_AVAILABLE = False


@dataclass
class FaceMeshResult:
    landmarks: Optional[any] = None   # mediapipe NormalizedLandmarkList
    landmark_list: List = field(default_factory=list)  # flat list of (x,y,z)


class FaceMeshAnalyzer:
    """
    Runs MediaPipe Face Mesh on a frame and returns 468 facial landmarks.
    Refine landmarks is enabled for higher-accuracy iris tracking.
    """
    def __init__(self):
        self._mesh = None
        if MP_AVAILABLE:
            self._mp_mesh = mp.solutions.face_mesh
            self._mesh = self._mp_mesh.FaceMesh(
                static_image_mode=False,
                max_num_faces=1,
                refine_landmarks=True,    # includes iris landmarks (468-477)
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )

    def analyze(self, frame: np.ndarray) -> FaceMeshResult:
        """
        Args:
            frame: BGR numpy array.
        Returns:
            FaceMeshResult with MediaPipe NormalizedLandmarkList or None.
        """
        if not MP_AVAILABLE or self._mesh is None:
            return FaceMeshResult(landmarks=None)

        rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = self._mesh.process(rgb)

        if result.multi_face_landmarks:
            lm = result.multi_face_landmarks[0]
            flat = [(p.x, p.y, p.z) for p in lm.landmark]
            return FaceMeshResult(landmarks=lm, landmark_list=flat)

        return FaceMeshResult(landmarks=None)
