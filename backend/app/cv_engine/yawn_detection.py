import numpy as np

# MediaPipe lip landmark indices
UPPER_LIP_TOP    = 13
LOWER_LIP_BOTTOM = 14
MOUTH_LEFT       = 61
MOUTH_RIGHT      = 291

# Additional vertical mouth points for MAR
MOUTH_UPPER = [82, 13, 312]
MOUTH_LOWER = [87, 14, 317]

def mouth_aspect_ratio(landmarks, w, h):
    """Mouth Aspect Ratio (MAR). > 0.6 = yawning."""
    try:
        def pt(i):
            return np.array([landmarks.landmark[i].x * w, landmarks.landmark[i].y * h])

        # Vertical distances
        d1 = np.linalg.norm(pt(82)  - pt(87))
        d2 = np.linalg.norm(pt(13)  - pt(14))
        d3 = np.linalg.norm(pt(312) - pt(317))

        # Horizontal distance
        dh = np.linalg.norm(pt(MOUTH_LEFT) - pt(MOUTH_RIGHT))

        mar = (d1 + d2 + d3) / (3.0 * dh + 1e-6)
        return round(float(mar), 4)
    except Exception:
        return 0.0

YAWN_MAR_THRESHOLD = 0.55

def detect_yawn(landmarks, w, h):
    """
    Returns (yawning: bool, yawn_score: float, mar: float)
    yawn_score is 1.0 when NOT yawning (contributes positively to engagement)
    """
    mar = mouth_aspect_ratio(landmarks, w, h)
    yawning = mar > YAWN_MAR_THRESHOLD
    # yawn_score = how NOT-yawning the student is (1.0 = alert, 0.0 = heavy yawn)
    yawn_score = max(0.0, 1.0 - (mar - YAWN_MAR_THRESHOLD) / 0.3) if yawning else 1.0
    return yawning, round(yawn_score, 3), mar