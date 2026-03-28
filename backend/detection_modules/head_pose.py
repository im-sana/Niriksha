"""
Head Pose Estimation Module
===========================
Estimates rough head direction from MediaPipe Face Mesh landmarks.

This module intentionally avoids hard dependency on dlib so backend startup
does not fail when dlib is not installed.
"""
from dataclasses import dataclass
from collections import deque
import math
from typing import Optional

import cv2
import numpy as np


@dataclass
class HeadPoseResult:
    direction: str  # 'center' | 'left' | 'right' | 'up' | 'down'
    pitch: float = 0.0
    yaw: float = 0.0
    roll: float = 0.0


class HeadPoseEstimator:
    """Estimate head pose direction from Face Mesh landmarks."""

    # MediaPipe landmark indices.
    NOSE_TIP = 1
    CHIN = 152
    LEFT_EYE = 33
    RIGHT_EYE = 263
    LEFT_MOUTH = 61
    RIGHT_MOUTH = 291

    # Canonical 3D model points for PnP solving.
    MODEL_POINTS = np.array(
        [
            (0.0, 0.0, 0.0),
            (0.0, -63.6, -12.5),
            (-43.3, 32.7, -26.0),
            (43.3, 32.7, -26.0),
            (-28.9, -28.9, -24.1),
            (28.9, -28.9, -24.1),
        ],
        dtype=np.float64,
    )

    ANGLE_HISTORY_SIZE = 10
    YAW_THRESHOLD = 15.0
    PITCH_THRESHOLD = 12.0

    def __init__(self):
        self._yaw_history = deque(maxlen=self.ANGLE_HISTORY_SIZE)
        self._pitch_history = deque(maxlen=self.ANGLE_HISTORY_SIZE)
        self._roll_history = deque(maxlen=self.ANGLE_HISTORY_SIZE)

    def _smooth(self, history: deque, value: float) -> float:
        history.append(value)
        return float(np.mean(history))

    @staticmethod
    def _camera_matrix(frame_shape: tuple[int, int, int]) -> tuple[np.ndarray, np.ndarray]:
        height, width = frame_shape[:2]
        focal_length = float(width)
        center = (width / 2.0, height / 2.0)
        camera_matrix = np.array(
            [
                [focal_length, 0.0, center[0]],
                [0.0, focal_length, center[1]],
                [0.0, 0.0, 1.0],
            ],
            dtype=np.float64,
        )
        dist_coeffs = np.zeros((4, 1), dtype=np.float64)
        return camera_matrix, dist_coeffs

    def _image_points_from_landmarks(self, landmarks, frame_shape) -> Optional[np.ndarray]:
        lm = getattr(landmarks, "landmark", None)
        if lm is None or len(lm) <= self.RIGHT_MOUTH:
            return None

        h, w = frame_shape[:2]
        indices = [
            self.NOSE_TIP,
            self.CHIN,
            self.LEFT_EYE,
            self.RIGHT_EYE,
            self.LEFT_MOUTH,
            self.RIGHT_MOUTH,
        ]

        try:
            return np.array(
                [(lm[i].x * w, lm[i].y * h) for i in indices],
                dtype=np.float64,
            )
        except Exception:
            return None

    def _solve_angles(self, image_points: np.ndarray, frame_shape: tuple[int, int, int]) -> Optional[tuple[float, float, float]]:
        camera_matrix, dist_coeffs = self._camera_matrix(frame_shape)

        success, rotation_vector, _ = cv2.solvePnP(
            self.MODEL_POINTS,
            image_points,
            camera_matrix,
            dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE,
        )
        if not success:
            return None

        rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
        sy = math.sqrt(rotation_matrix[0, 0] ** 2 + rotation_matrix[1, 0] ** 2)
        singular = sy < 1e-6

        if not singular:
            pitch = math.atan2(rotation_matrix[2, 1], rotation_matrix[2, 2])
            yaw = math.atan2(-rotation_matrix[2, 0], sy)
            roll = math.atan2(rotation_matrix[1, 0], rotation_matrix[0, 0])
        else:
            pitch = math.atan2(-rotation_matrix[1, 2], rotation_matrix[1, 1])
            yaw = math.atan2(-rotation_matrix[2, 0], sy)
            roll = 0.0

        return float(np.degrees(pitch)), float(np.degrees(yaw)), float(np.degrees(roll))

    def estimate(self, frame: np.ndarray, landmarks) -> HeadPoseResult:
        """
        Estimate head direction from frame and MediaPipe landmarks.
        Returns a safe default when inputs are invalid.
        """
        if (
            frame is None
            or not isinstance(frame, np.ndarray)
            or frame.size == 0
            or landmarks is None
        ):
            return HeadPoseResult(direction="center")

        image_points = self._image_points_from_landmarks(landmarks, frame.shape)
        if image_points is None:
            return HeadPoseResult(direction="center")

        angles = self._solve_angles(image_points, frame.shape)
        if angles is None:
            return HeadPoseResult(direction="center")

        pitch = self._smooth(self._pitch_history, angles[0])
        yaw = self._smooth(self._yaw_history, angles[1])
        roll = self._smooth(self._roll_history, angles[2])

        if yaw <= -self.YAW_THRESHOLD:
            direction = "left"
        elif yaw >= self.YAW_THRESHOLD:
            direction = "right"
        elif pitch >= self.PITCH_THRESHOLD:
            direction = "up"
        elif pitch <= -self.PITCH_THRESHOLD:
            direction = "down"
        else:
            direction = "center"

        return HeadPoseResult(direction=direction, pitch=pitch, yaw=yaw, roll=roll)