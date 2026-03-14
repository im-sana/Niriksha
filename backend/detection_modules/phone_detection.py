"""
Phone Detection Module — YOLOv8 Object Detection
==================================================
Detects mobile phones in the exam frame using YOLOv8.
COCO class index for "cell phone" = 67.

Detecting a phone is a strong cheating signal (+10 score).
"""
from dataclasses import dataclass, field
from typing import List
import numpy as np

try:
    from ultralytics import YOLO
    _model = YOLO("yolov8n.pt")  # shared model (same file, different class filter)
    YOLO_AVAILABLE = True
except Exception:
    YOLO_AVAILABLE = False
    _model = None


@dataclass
class PhoneDetectionResult:
    detected:    bool
    confidence:  float = 0.0
    boxes:       List  = field(default_factory=list)


# COCO class 67 = "cell phone"
PHONE_CLASS  = 67
CONFIDENCE   = 0.40


class PhoneDetector:
    """
    Detects mobile phones using YOLOv8 object detection.
    Lower confidence threshold (0.40) to catch partially visible phones.
    """

    def detect(self, frame: np.ndarray) -> PhoneDetectionResult:
        """
        Args:
            frame: BGR numpy array.
        Returns:
            PhoneDetectionResult with detected flag.
        """
        if not YOLO_AVAILABLE or _model is None:
            return PhoneDetectionResult(detected=False)

        results = _model(frame, verbose=False, conf=CONFIDENCE, classes=[PHONE_CLASS])
        boxes = []
        max_conf = 0.0

        for r in results:
            for box in r.boxes:
                if int(box.cls[0]) == PHONE_CLASS:
                    conf = float(box.conf[0])
                    max_conf = max(max_conf, conf)
                    boxes.append(box.xyxy[0].tolist() + [conf])

        return PhoneDetectionResult(
            detected=len(boxes) > 0,
            confidence=max_conf,
            boxes=boxes,
        )
