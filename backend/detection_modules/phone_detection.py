"""
Phone Detection Module - YOLO-based mobile phone detection.

Loads a local YOLO weights file in a cross-platform way and fails open
when the model or runtime dependencies are unavailable.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import os

import numpy as np

try:
    import cv2
    CV2_AVAILABLE = True
except Exception:
    cv2 = None
    CV2_AVAILABLE = False

try:
    import torch
except Exception:
    torch = None

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except Exception:
    YOLO = None
    YOLO_AVAILABLE = False


@dataclass
class PhoneDetectionResult:
    detected: bool
    confidence: float = 0.0
    bbox: Optional[tuple] = None  # (x1, y1, x2, y2)


class PhoneDetector:
    """Detect mobile phones in a frame using a local YOLO model."""

    CONFIDENCE_THRESHOLD = 0.35
    PHONE_CLASS_INDEX = 67  # COCO class id for 'cell phone'

    def __init__(self, model_path: Optional[str] = None):
        self._model = None
        self._device = "cpu"
        self._model_path = self._resolve_model_path(model_path)
        self._phone_class_index = self.PHONE_CLASS_INDEX
        self._accept_any_class = False
        self._initialize_model()

    def _resolve_model_path(self, model_path: Optional[str]) -> Optional[Path]:
        """Resolve model path from explicit arg, env var, or backend default."""
        if model_path:
            return Path(model_path)

        env_model_path = os.getenv("YOLO_PHONE_MODEL_PATH")
        if env_model_path:
            return Path(env_model_path)

        backend_root = Path(__file__).resolve().parent.parent
        for name in ("best_yolov8.pt", "yolov8n.pt", "yolo26n.pt"):
            candidate = backend_root / name
            if candidate.exists():
                return candidate
        return backend_root / "best_yolov8.pt"

    def _candidate_model_paths(self) -> list[Path]:
        """Return model candidates in fallback order."""
        if self._model_path is not None:
            primary = self._model_path
        else:
            primary = Path("yolov8n.pt")

        backend_root = Path(__file__).resolve().parent.parent
        candidates = [
            primary,
            backend_root / "best_yolov8.pt",
            backend_root / "yolov8n.pt",
            backend_root / "yolo26n.pt",
        ]

        seen = set()
        ordered = []
        for p in candidates:
            key = str(p)
            if key in seen:
                continue
            seen.add(key)
            ordered.append(p)
        return ordered

    def _build_model(self):
        """Load YOLO while handling torch>=2.6 weights_only default for trusted local weights."""
        if torch is None:
            return YOLO(str(self._model_path))

        original_torch_load = torch.load

        def _torch_load_compat(*args, **kwargs):
            kwargs.setdefault("weights_only", False)
            return original_torch_load(*args, **kwargs)

        try:
            torch.load = _torch_load_compat
            return YOLO(str(self._model_path))
        finally:
            torch.load = original_torch_load

    def _infer_phone_class_index(self) -> int:
        """Infer phone class index from YOLO class names; fallback to COCO id."""
        try:
            # If this is a single-class custom detector, accept class 0.
            nc = getattr(self._model.model, "nc", None)
            if nc == 1:
                self._accept_any_class = True
                return 0

            names = getattr(self._model.model, "names", None)
            if names is None:
                names = getattr(self._model, "names", None)
            if isinstance(names, dict):
                iterable = names.items()
            elif isinstance(names, list):
                iterable = enumerate(names)
            else:
                return self.PHONE_CLASS_INDEX

            for idx, name in iterable:
                label = str(name).lower().strip()
                if label in {"cell phone", "cellphone", "mobile phone", "phone"}:
                    return int(idx)
        except Exception:
            pass
        return self.PHONE_CLASS_INDEX

    def _initialize_model(self) -> None:
        """Initialize YOLO model. Keep detector alive even if load fails."""
        if not YOLO_AVAILABLE:
            self._model = None
            return

        self._model = None
        for candidate in self._candidate_model_paths():
            self._model_path = candidate
            if candidate.exists():
                try:
                    self._model = self._build_model()
                    break
                except Exception:
                    self._model = None
                    continue
            else:
                # Allow auto-download on named models like yolov8n.pt
                try:
                    self._model = self._build_model()
                    break
                except Exception:
                    self._model = None
                    continue

        if self._model is None:
            return

        try:
            if torch is not None and torch.cuda.is_available():
                self._device = "cuda"
            self._model.to(self._device)
        except Exception:
            self._model = None
            return

        self._phone_class_index = self._infer_phone_class_index()

    def detect(self, frame: np.ndarray) -> PhoneDetectionResult:
        """Run phone detection on a BGR frame and return a structured result."""
        if (
            self._model is None
            or not CV2_AVAILABLE
            or frame is None
            or not isinstance(frame, np.ndarray)
            or frame.size == 0
        ):
            return PhoneDetectionResult(detected=False)

        best_conf = 0.0
        best_bbox = None

        try:
            results = self._model(frame, verbose=False)
        except Exception:
            return PhoneDetectionResult(detected=False)

        for result in results:
            for box in result.boxes:
                conf = float(box.conf[0].item())
                cls = int(box.cls[0].item())

                if conf < self.CONFIDENCE_THRESHOLD:
                    continue

                if not self._accept_any_class and cls != self._phone_class_index:
                    continue

                if conf > best_conf:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    best_conf = conf
                    best_bbox = (x1, y1, x2, y2)

        return PhoneDetectionResult(
            detected=best_bbox is not None,
            confidence=best_conf,
            bbox=best_bbox,
        )


def process_mobile_detection(frame):
    """Backward-compatible helper used by older callers."""
    detector = PhoneDetector()
    result = detector.detect(frame)
    return frame, result.detected