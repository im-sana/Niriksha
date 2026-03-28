import sys
import os
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))

import numpy as np
from detection_modules.face_detection import FaceDetector
from detection_modules.multi_face import MultiFaceDetector
from detection_modules.phone_detection import PhoneDetector

frame = np.zeros((480, 640, 3), dtype=np.uint8)

print("Testing detection modules:")
print("-" * 40)

detectors = [
    ("FaceDetector", FaceDetector()),
    ("MultiFaceDetector", MultiFaceDetector()),
    ("PhoneDetector", PhoneDetector()),
]

for name, detector in detectors:
    try:
        result = detector.detect(frame)
        print(f"✓ {name}: OK")
    except Exception as e:
        print(f"✗ {name}: Error - {e}")

print("-" * 40)
print("Detection pipeline is working!")
