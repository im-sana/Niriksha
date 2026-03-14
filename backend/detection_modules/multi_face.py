"""
Multiple Face Detection Module — YOLOv8
=========================================
Uses YOLOv8 (Ultralytics) to count the number of people/faces in frame.
If more than one person is detected → possible impersonation or collaboration.

Falls back to a mock result if ultralytics is not installed.
"""
from dataclasses import dataclass, field
from typing import List
import numpy as np

try:
    from ultralytics import YOLO
    _model = YOLO("yolov8n.pt")  # auto-downloads on first run
    YOLO_AVAILABLE = True
except Exception:
    YOLO_AVAILABLE = False
    _model = None


@dataclass
class MultiFaceResult:
    face_count: int
    boxes:      List = field(default_factory=list)  # list of [x1,y1,x2,y2,conf]


# COCO class index for "person" = 0
PERSON_CLASS = 0
CONFIDENCE   = 0.45


class MultiFaceDetector:
    """
    Detects the number of persons visible in the exam frame.
    Uses YOLOv8n (nano) for low-latency inference.
    """

    def detect(self, frame: np.ndarray) -> MultiFaceResult:
        """
        Args:
            frame: BGR numpy array.
        Returns:
            MultiFaceResult with person count and bounding boxes.
        """
        if not YOLO_AVAILABLE or _model is None:
            # Mock: assume single face present
            return MultiFaceResult(face_count=1)

        results = _model(frame, verbose=False, conf=CONFIDENCE, classes=[PERSON_CLASS])
        boxes = []
        count = 0
        for r in results:
            for box in r.boxes:
                if int(box.cls[0]) == PERSON_CLASS:
                    count += 1
                    boxes.append(box.xyxy[0].tolist() + [float(box.conf[0])])

        return MultiFaceResult(face_count=count, boxes=boxes)
