"""
Hand Detection Module — MediaPipe Hands
=========================================
Uses MediaPipe Hands to detect hand presence and classify hand movements
as suspicious (e.g., reaching off-camera, passing objects).

Suspicious criteria:
  - Wrist y-coordinate above shoulder level (hand raised unusually high)
  - Hand moves far outside the face region (reaching to side pocket etc.)
  - Multiple hands detected simultaneously
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
class HandDetectionResult:
    hands_detected: int
    suspicious:     bool
    reason:         Optional[str] = None
    landmarks_list: List = field(default_factory=list)


# Key landmark indices (MediaPipe Hands)
WRIST       = 0
THUMB_TIP   = 4
INDEX_TIP   = 8
MIDDLE_TIP  = 12


class HandDetector:
    """
    Detects hands and flags suspicious movement patterns.
    """
    def __init__(self):
        self._hands = None
        if MP_AVAILABLE:
            self._mp_hands = mp.solutions.hands
            self._hands = self._mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=2,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )

    def detect(self, frame: np.ndarray) -> HandDetectionResult:
        """
        Args:
            frame: BGR numpy array.
        Returns:
            HandDetectionResult with suspicious flag and reason.
        """
        if not MP_AVAILABLE or self._hands is None:
            return HandDetectionResult(hands_detected=0, suspicious=False)

        rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = self._hands.process(rgb)

        if not result.multi_hand_landmarks:
            return HandDetectionResult(hands_detected=0, suspicious=False)

        count = len(result.multi_hand_landmarks)
        suspicious = False
        reason = None

        for hand_lm in result.multi_hand_landmarks:
            lm = hand_lm.landmark
            wrist_y = lm[WRIST].y

            # Heuristic 1: Wrist very high in frame (raising hand suspiciously)
            if wrist_y < 0.25:
                suspicious = True
                reason = "Hand raised suspiciously high"
                break

            # Heuristic 2: Hand near edge of frame (reaching off camera)
            wrist_x = lm[WRIST].x
            if wrist_x < 0.05 or wrist_x > 0.95:
                suspicious = True
                reason = "Hand near frame edge (reaching off camera)"
                break

        # Two hands visible could indicate passing materials
        if count >= 2 and not suspicious:
            suspicious = True
            reason = "Two hands detected simultaneously"

        return HandDetectionResult(
            hands_detected=count,
            suspicious=suspicious,
            reason=reason,
        )
