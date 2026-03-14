"""
Head Pose Estimation Module — OpenCV solvePnP
================================================
Uses 6 facial landmark reference points and OpenCV's solvePnP algorithm
to estimate the 3D rotation of the head (yaw, pitch, roll).

Detects:
  - Head turned left  (yaw > +threshold)
  - Head turned right (yaw < -threshold)
  - Head tilted down  (pitch > +threshold)

Reference points (MediaPipe Face Mesh indices):
  1 = Nose tip
  9 = Chin
  57 = Left eye left corner
  287 = Right eye right corner
  130 = Left mouth corner
  359 = Right mouth corner
"""
from dataclasses import dataclass
import numpy as np

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False


@dataclass
class HeadPoseResult:
    direction:  str   # 'center' | 'left' | 'right' | 'down' | 'up'
    yaw:        float = 0.0
    pitch:      float = 0.0
    roll:       float = 0.0


# 3D model reference points (in mm, standard head model)
MODEL_POINTS_3D = np.array([
    (0.0,    0.0,    0.0),    # Nose tip
    (0.0,  -330.0, -65.0),    # Chin
    (-225.0, 170.0, -135.0),  # Left eye left corner
    (225.0,  170.0, -135.0),  # Right eye right corner
    (-150.0, -150.0, -125.0), # Left mouth corner
    (150.0,  -150.0, -125.0), # Right mouth corner
], dtype=np.float64)

# Landmark indices for the 6 reference points
LANDMARK_INDICES = [1, 9, 57, 287, 130, 359]

# Thresholds (degrees)
YAW_THRESH   = 20   # degrees
PITCH_THRESH = 20


class HeadPoseEstimator:
    """
    Estimates head orientation using PnP (Perspective-n-Point) algorithm.
    Camera matrix is approximated from frame dimensions.
    """

    def estimate(self, frame: np.ndarray, landmarks) -> HeadPoseResult:
        """
        Args:
            frame:     BGR OpenCV frame (used for camera matrix approximation).
            landmarks: MediaPipe NormalizedLandmarkList.
        Returns:
            HeadPoseResult with yaw, pitch, roll in degrees.
        """
        if not CV2_AVAILABLE or landmarks is None:
            return HeadPoseResult(direction="center")

        h, w = frame.shape[:2]
        lm   = landmarks.landmark

        # 2D image points from landmarks
        image_points_2d = []
        for idx in LANDMARK_INDICES:
            if idx >= len(lm):
                return HeadPoseResult(direction="center")
            lp = lm[idx]
            image_points_2d.append((lp.x * w, lp.y * h))
        image_points_2d = np.array(image_points_2d, dtype=np.float64)

        # Camera intrinsics (approximation: focal_length = image_width)
        focal_length  = float(w)
        center        = (w / 2.0, h / 2.0)
        camera_matrix = np.array([
            [focal_length, 0,            center[0]],
            [0,            focal_length, center[1]],
            [0,            0,            1        ],
        ], dtype=np.float64)

        dist_coeffs = np.zeros((4, 1))  # Assume no radial distortion

        success, rot_vec, trans_vec = cv2.solvePnP(
            MODEL_POINTS_3D,
            image_points_2d,
            camera_matrix,
            dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE,
        )

        if not success:
            return HeadPoseResult(direction="center")

        # Convert rotation vector to Euler angles
        rot_mat, _ = cv2.Rodrigues(rot_vec)
        proj_matrix = np.hstack((rot_mat, trans_vec))
        _, _, _, _, _, _, euler_angles = cv2.decomposeProjectionMatrix(proj_matrix)

        pitch_deg = euler_angles[0, 0]
        yaw_deg   = euler_angles[1, 0]
        roll_deg  = euler_angles[2, 0]

        # Classify direction
        if yaw_deg > YAW_THRESH:
            direction = "left"
        elif yaw_deg < -YAW_THRESH:
            direction = "right"
        elif pitch_deg > PITCH_THRESH:
            direction = "down"
        else:
            direction = "center"

        return HeadPoseResult(direction=direction, yaw=yaw_deg, pitch=pitch_deg, roll=roll_deg)
