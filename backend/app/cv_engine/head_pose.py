import numpy as np
import cv2

# 3D model points of key facial landmarks (in mm)
MODEL_POINTS = np.array([
    (0.0,    0.0,    0.0),    # Nose tip            - landmark 1
    (0.0,   -330.0, -65.0),   # Chin                - landmark 152
    (-225.0, 170.0, -135.0),  # Left eye corner     - landmark 33
    (225.0,  170.0, -135.0),  # Right eye corner    - landmark 263
    (-150.0,-150.0, -125.0),  # Left mouth corner   - landmark 61
    (150.0, -150.0, -125.0),  # Right mouth corner  - landmark 291
], dtype=np.float64)

LANDMARK_IDS = [1, 152, 33, 263, 61, 291]

def estimate_head_pose(landmarks, w, h):
    """
    Returns (pose: str, pose_score: float, yaw: float, pitch: float)
    """
    try:
        image_points = np.array([
            (landmarks.landmark[i].x * w, landmarks.landmark[i].y * h)
            for i in LANDMARK_IDS
        ], dtype=np.float64)

        focal_length = w
        center = (w / 2.0, h / 2.0)
        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype=np.float64)

        dist_coeffs = np.zeros((4, 1))
        success, rotation_vec, translation_vec = cv2.solvePnP(
            MODEL_POINTS, image_points, camera_matrix, dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE
        )
        if not success:
            return "center", 1.0, 0.0, 0.0

        rotation_mat, _ = cv2.Rodrigues(rotation_vec)
        proj_matrix = np.hstack((rotation_mat, translation_vec))
        _, _, _, _, _, _, euler_angles = cv2.decomposeProjectionMatrix(proj_matrix)

        pitch = float(euler_angles[0])
        yaw   = float(euler_angles[1])
        roll  = float(euler_angles[2])

        # Classify pose
        if abs(yaw) < 15 and abs(pitch) < 15:
            pose = "center"
            pose_score = 1.0
        elif yaw > 15:
            pose = "left"
            pose_score = max(0.0, 1.0 - (yaw - 15) / 30)
        elif yaw < -15:
            pose = "right"
            pose_score = max(0.0, 1.0 - (-yaw - 15) / 30)
        elif pitch > 15:
            pose = "down"
            pose_score = max(0.0, 1.0 - (pitch - 15) / 30)
        else:
            pose = "up"
            pose_score = max(0.0, 1.0 - (-pitch - 15) / 30)

        return pose, round(pose_score, 3), round(yaw, 1), round(pitch, 1)

    except Exception:
        return "center", 1.0, 0.0, 0.0