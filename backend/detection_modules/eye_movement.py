"""
Eye Movement Detection Module
=================================
Uses MediaPipe Face Mesh iris landmarks (indices 468-473) to estimate
gaze direction: left | right | down | center.

Algorithm:
  - Left iris center:  landmark 468
  - Right iris center: landmark 473
  - Eye corners define the allowed horizontal range.
  - Iris position relative to eye bounding box → gaze direction.
"""
from dataclasses import dataclass
import numpy as np


@dataclass
class EyeMovementResult:
    direction: str    # 'center' | 'left' | 'right' | 'down'
    ratio_h:   float = 0.0   # horizontal iris ratio (0=full left, 1=full right)
    ratio_v:   float = 0.0   # vertical iris ratio (0=top, 1=bottom)


# MediaPipe landmark indices
# Left eye corners: outer=33, inner=133
# Right eye corners: outer=362, inner=263
# Left eye upper/lower: 159 / 145
# Right eye upper/lower: 386 / 374
# Iris centers (require refine_landmarks=True):
#   Left iris: 468, right iris: 473

LEFT_IRIS   = 468
RIGHT_IRIS  = 473
LEFT_OUTER  = 33
LEFT_INNER  = 133
LEFT_UPPER  = 159
LEFT_LOWER  = 145
RIGHT_OUTER = 362
RIGHT_INNER = 263
RIGHT_UPPER = 386
RIGHT_LOWER = 374

# Thresholds
H_LEFT_THRESH  = 0.35   # iris ratio < this → looking left
H_RIGHT_THRESH = 0.65   # iris ratio > this → looking right
V_DOWN_THRESH  = 0.65   # vertical ratio > this → looking down


class EyeMovementDetector:
    """
    Determines gaze direction from Face Mesh landmarks.
    Averages the left and right eye iris positions.
    """

    def detect(self, landmarks, frame_shape) -> EyeMovementResult:
        """
        Args:
            landmarks: MediaPipe NormalizedLandmarkList (468 landmarks).
            frame_shape: (H, W, C) tuple from the OpenCV frame.
        Returns:
            EyeMovementResult with direction string.
        """
        if landmarks is None:
            return EyeMovementResult(direction="center")

        lm = landmarks.landmark

        # Guard: ensure iris landmarks are present (index 468, 473)
        if len(lm) <= RIGHT_IRIS:
            return EyeMovementResult(direction="center")

        # ── Left eye ──
        l_iris_x  = lm[LEFT_IRIS].x
        l_outer_x = lm[LEFT_OUTER].x
        l_inner_x = lm[LEFT_INNER].x
        l_iris_y  = lm[LEFT_IRIS].y
        l_upper_y = lm[LEFT_UPPER].y
        l_lower_y = lm[LEFT_LOWER].y

        # MediaPipe inner_x is typically greater than outer_x for the left eye, but can vary by person/rotation
        l_min_x, l_max_x = min(l_inner_x, l_outer_x), max(l_inner_x, l_outer_x)
        l_h_ratio = (l_iris_x - l_min_x) / max(l_max_x - l_min_x, 1e-6)

        l_min_y, l_max_y = min(l_upper_y, l_lower_y), max(l_upper_y, l_lower_y)
        l_v_ratio = (l_iris_y - l_min_y) / max(l_max_y - l_min_y, 1e-6)

        # ── Right eye ──
        r_iris_x  = lm[RIGHT_IRIS].x
        r_outer_x = lm[RIGHT_OUTER].x
        r_inner_x = lm[RIGHT_INNER].x
        r_iris_y  = lm[RIGHT_IRIS].y
        r_upper_y = lm[RIGHT_UPPER].y
        r_lower_y = lm[RIGHT_LOWER].y

        r_min_x, r_max_x = min(r_inner_x, r_outer_x), max(r_inner_x, r_outer_x)
        r_h_ratio = (r_iris_x - r_min_x) / max(r_max_x - r_min_x, 1e-6)
        
        r_min_y, r_max_y = min(r_upper_y, r_lower_y), max(r_upper_y, r_lower_y)
        r_v_ratio = (r_iris_y - r_min_y) / max(r_max_y - r_min_y, 1e-6)

        # Average both eyes
        avg_h = (l_h_ratio + r_h_ratio) / 2.0
        avg_v = (l_v_ratio + r_v_ratio) / 2.0

        # ── Classify ──
        if avg_v > V_DOWN_THRESH:
            direction = "down"
        elif avg_h < H_LEFT_THRESH:
            direction = "left"
        elif avg_h > H_RIGHT_THRESH:
            direction = "right"
        else:
            direction = "center"

        return EyeMovementResult(direction=direction, ratio_h=avg_h, ratio_v=avg_v)
