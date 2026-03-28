#!/usr/bin/env python
"""Test detection pipeline via frame analysis"""
import base64
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

import numpy as np
import cv2
from app import face_detector, multi_face, phone_detector, score_engine, CheatingScoreEngine

# Create a test frame (black image)
frame = np.zeros((480, 640, 3), dtype=np.uint8)
_, img_encoded = cv2.imencode('.jpg', frame)
img_b64 = base64.b64encode(img_encoded).decode()

print("Testing detection pipeline:")
print("-" * 50)

# Decode frame
img_bytes = base64.b64decode(img_b64)
nparr = np.frombuffer(img_bytes, np.uint8)
frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

results = {}
events = []

# Run detection pipeline
try:
    face_result = face_detector.detect(frame)
    results["face_present"] = face_result.face_present
    if not face_result.face_present:
        events.append({"type": "face_missing", "message": "Face not visible", "score": 5})
    print(f"✓ Face detection: {face_result.face_present}")

    multi_result = multi_face.detect(frame)
    results["face_count"] = multi_result.face_count
    if multi_result.face_count > 1:
        events.append({"type": "multiple_faces", "message": f"{multi_result.face_count} faces", "score": 10})
    print(f"✓ Multi-face detection: {multi_result.face_count} face(s)")

    phone_result = phone_detector.detect(frame)
    results["phone_detected"] = phone_result.detected
    if phone_result.detected:
        events.append({"type": "phone_detected", "message": "Phone detected", "score": 10})
    print(f"✓ Phone detection: {phone_result.detected}")

    print("-" * 50)
    print(f"✓ Detection works!")
    print(f"  Events detected: {len(events)}")
    print(f"  Results: {list(results.keys())}")

except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()
