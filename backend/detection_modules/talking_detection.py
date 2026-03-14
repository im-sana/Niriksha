"""
Talking Detection Module — Mouth Aspect Ratio (MAR)
=====================================================
Detects if the student is talking by computing the Mouth Aspect Ratio (MAR),
similar in concept to the Eye Aspect Ratio (EAR) used for blink detection.

MAR = (||P2 - P8|| + ||P3 - P7|| + ||P4 - P6||) / (2 * ||P1 - P5||)
Where P1-P8 are lip landmark points.

If MAR exceeds the threshold for N consecutive frames → talking detected.

MediaPipe Face Mesh outer lip indices used:
  Upper lip: 13 (mid top)
  Lower lip: 14 (mid bottom)
  Left corner: 78
  Right corner: 308
"""
from dataclasses import dataclass
import numpy as np
from collections import deque


@dataclass
class TalkingResult:
    is_talking:  bool
    mar:         float = 0.0


# ── Lip landmark indices (MediaPipe Face Mesh) ──
UPPER_LIP  = 13
LOWER_LIP  = 14
LEFT_CORNER  = 78
RIGHT_CORNER = 308
UPPER_MID2   = 312   # secondary upper point
UPPER_MID3   = 82    # secondary upper point
LOWER_MID2   = 317   # secondary lower point
LOWER_MID3   = 87    # secondary lower point

MAR_THRESHOLD = 0.035   # normalized units; above = mouth significantly open
CONSEC_FRAMES  = 3       # frames MAR must exceed threshold to flag talking


class TalkingDetector:
    """
    Computes MAR from Face Mesh landmarks and detects sustained mouth opening.
    """
    def __init__(self):
        self._mar_buffer = deque(maxlen=CONSEC_FRAMES * 2)

    def _distance(self, a, b) -> float:
        """Euclidean distance between two normalized landmarks."""
        return ((a.x - b.x)**2 + (a.y - b.y)**2 + (a.z - b.z)**2) ** 0.5

    def detect(self, landmarks) -> TalkingResult:
        """
        Args:
            landmarks: MediaPipe NormalizedLandmarkList (from face_mesh.py).
        Returns:
            TalkingResult with is_talking flag and current MAR.
        """
        if landmarks is None:
            return TalkingResult(is_talking=False)

        lm = landmarks.landmark
        if len(lm) <= max(UPPER_LIP, LOWER_LIP, LEFT_CORNER, RIGHT_CORNER):
            return TalkingResult(is_talking=False)

        # Compute mouth aspect ratio
        vertical   = self._distance(lm[UPPER_LIP], lm[LOWER_LIP])
        horizontal = self._distance(lm[LEFT_CORNER], lm[RIGHT_CORNER])
        mar = vertical / max(horizontal, 1e-6)

        self._mar_buffer.append(mar > MAR_THRESHOLD)

        # Talking if threshold exceeded for CONSEC_FRAMES consecutive frames
        consec = sum(1 for v in list(self._mar_buffer)[-CONSEC_FRAMES:] if v)
        is_talking = consec >= CONSEC_FRAMES

        return TalkingResult(is_talking=is_talking, mar=mar)
