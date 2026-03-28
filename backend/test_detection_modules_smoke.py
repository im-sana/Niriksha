import numpy as np

from detection_modules.face_detection import FaceDetector
from detection_modules.face_mesh import FaceMeshAnalyzer
from detection_modules.hand_detection import HandDetector
from detection_modules.head_pose import HeadPoseEstimator
from detection_modules.multi_face import MultiFaceDetector
from detection_modules.phone_detection import PhoneDetector
from detection_modules.talking_detection import TalkingDetector
from detection_modules.eye_movement import EyeMovementDetector


def test_face_detector_handles_invalid_frame():
    detector = FaceDetector()
    result = detector.detect(None)
    assert isinstance(result.face_present, bool)


def test_face_mesh_handles_invalid_frame():
    analyzer = FaceMeshAnalyzer()
    result = analyzer.analyze(None)
    assert result.landmarks is None


def test_hand_detector_handles_invalid_frame():
    detector = HandDetector()
    result = detector.detect(None)
    assert result.hands_detected == 0
    assert result.suspicious is False


def test_head_pose_handles_invalid_inputs():
    estimator = HeadPoseEstimator()
    result = estimator.estimate(None, None)
    assert result.direction == "center"


def test_multi_face_handles_invalid_frame():
    detector = MultiFaceDetector()
    result = detector.detect(None)
    assert result.face_count >= 0


def test_phone_detector_handles_invalid_frame():
    detector = PhoneDetector()
    result = detector.detect(None)
    assert result.detected is False


def test_talking_detector_handles_none_landmarks():
    detector = TalkingDetector()
    result = detector.detect(None)
    assert result.is_talking is False


def test_eye_movement_handles_none_landmarks():
    detector = EyeMovementDetector()
    result = detector.detect(None, (480, 640, 3))
    assert result.direction == "center"


def test_modules_handle_empty_numpy_frame_without_crash():
    frame = np.array([])
    assert FaceDetector().detect(frame)
    assert FaceMeshAnalyzer().analyze(frame)
    assert HandDetector().detect(frame)
    assert MultiFaceDetector().detect(frame)
    assert PhoneDetector().detect(frame)
