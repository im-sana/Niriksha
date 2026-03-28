"""
Multiple Face Detection Module — YOLOv8
=========================================
Uses YOLOv8 (Ultralytics) to count the number of people/faces in frame.
If more than one person is detected → possible impersonation or collaboration.

Falls back to a mock result if ultralytics is not installed.
"""
from dataclasses import dataclass, field
from typing import List
import os
import numpy as np

try:
    import torch
except Exception:
    torch = None


def _resolve_model_path() -> str:
    env_model = os.getenv("YOLO_MODEL_PATH")
    if env_model:
        candidate = env_model
        if not os.path.isabs(candidate):
            candidate = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", candidate))
        if os.path.exists(candidate):
            return candidate

    # Prefer generic YOLO person models first for multi-person counting.
    for model_name in ("yolov8n.pt", "yolo26n.pt", "best_yolov8.pt"):
        candidate = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", model_name))
        if os.path.exists(candidate):
            return candidate

    return "yolov8n.pt"  # default to model name for auto-download


def _build_yolo_model(model_path: str):
    """Load YOLO while handling torch>=2.6 weights_only default for trusted local weights."""
    if torch is None:
        return YOLO(model_path)

    original_torch_load = torch.load

    def _torch_load_compat(*args, **kwargs):
        kwargs.setdefault("weights_only", False)
        return original_torch_load(*args, **kwargs)

    try:
        torch.load = _torch_load_compat
        return YOLO(model_path)
    finally:
        torch.load = original_torch_load

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except Exception:
    YOLO_AVAILABLE = False
    YOLO = None


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

    def __init__(self):
        self._model = None
        self._model_path = _resolve_model_path()
        self._initialize_model()

    def _candidate_model_paths(self) -> list[str]:
        candidates = [
            self._model_path,
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "yolov8n.pt")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "yolo26n.pt")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "best_yolov8.pt")),
            "yolov8n.pt",
        ]
        seen = set()
        ordered = []
        for p in candidates:
            if p in seen:
                continue
            seen.add(p)
            ordered.append(p)
        return ordered

    def _initialize_model(self):
        if not YOLO_AVAILABLE:
            self._model = None
            return

        for candidate in self._candidate_model_paths():
            try:
                self._model = _build_yolo_model(candidate)
                self._model_path = candidate
                return
            except Exception:
                self._model = None
                continue

    def detect(self, frame: np.ndarray) -> MultiFaceResult:
        """
        Args:
            frame: BGR numpy array.
        Returns:
            MultiFaceResult with person count and bounding boxes.
        """
        if (
            not YOLO_AVAILABLE
            or self._model is None
            or frame is None
            or not isinstance(frame, np.ndarray)
            or frame.size == 0
        ):
            # Mock: assume single face present
            return MultiFaceResult(face_count=1)

        try:
            results = self._model(frame, verbose=False, conf=CONFIDENCE, classes=[PERSON_CLASS])
        except Exception:
            return MultiFaceResult(face_count=1)
        boxes = []
        count = 0
        for r in results:
            for box in r.boxes:
                if int(box.cls[0]) == PERSON_CLASS:
                    count += 1
                    boxes.append(box.xyxy[0].tolist() + [float(box.conf[0])])

        return MultiFaceResult(face_count=count, boxes=boxes)
