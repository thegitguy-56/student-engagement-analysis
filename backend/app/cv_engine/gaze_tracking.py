import numpy as np

# MediaPipe iris landmark indices
LEFT_IRIS  = [474, 475, 476, 477]
RIGHT_IRIS = [469, 470, 471, 472]

# Eye corner indices
LEFT_EYE_INNER  = 133
LEFT_EYE_OUTER  = 33
RIGHT_EYE_INNER = 362
RIGHT_EYE_OUTER = 263

def get_iris_center(landmarks, indices, w, h):
    pts = [(landmarks.landmark[i].x * w, landmarks.landmark[i].y * h) for i in indices]
    cx = np.mean([p[0] for p in pts])
    cy = np.mean([p[1] for p in pts])
    return cx, cy

def compute_gaze(landmarks, w, h):
    """
    Returns (eye_contact: bool, gaze_score: float 0-1, direction: str)
    """
    try:
        lx, ly = get_iris_center(landmarks, LEFT_IRIS,  w, h)
        rx, ry = get_iris_center(landmarks, RIGHT_IRIS, w, h)

        # Left eye horizontal ratio
        left_inner  = landmarks.landmark[LEFT_EYE_INNER]
        left_outer  = landmarks.landmark[LEFT_EYE_OUTER]
        l_ratio = (lx/w - left_outer.x) / (left_inner.x - left_outer.x + 1e-6)

        # Right eye horizontal ratio
        right_inner = landmarks.landmark[RIGHT_EYE_INNER]
        right_outer = landmarks.landmark[RIGHT_EYE_OUTER]
        r_ratio = (rx/w - right_outer.x) / (right_inner.x - right_outer.x + 1e-6)

        avg_ratio = (l_ratio + r_ratio) / 2.0

        # 0.4-0.6 = looking at screen
        if 0.35 <= avg_ratio <= 0.65:
            direction = "center"
            eye_contact = True
            gaze_score = 1.0
        elif avg_ratio < 0.35:
            direction = "right"
            eye_contact = False
            gaze_score = max(0.0, avg_ratio / 0.35)
        else:
            direction = "left"
            eye_contact = False
            gaze_score = max(0.0, (1.0 - avg_ratio) / 0.35)

        return eye_contact, round(gaze_score, 3), direction

    except Exception:
        return False, 0.0, "unknown"