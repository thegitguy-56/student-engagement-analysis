import numpy as np

# Emotion scoring based on MediaPipe face mesh landmarks
# Uses mouth curvature, eye openness, brow position

EMOTION_SCORES = {
    "happy":    1.0,
    "surprise": 0.8,
    "neutral":  0.6,
    "sad":      0.3,
    "angry":    0.2,
    "bored":    0.1,
}

# Key landmark indices
MOUTH_LEFT        = 61
MOUTH_RIGHT       = 291
MOUTH_TOP         = 13
MOUTH_BOTTOM      = 14
LEFT_BROW_INNER   = 107
RIGHT_BROW_INNER  = 336
LEFT_EYE_TOP      = 159
LEFT_EYE_BOTTOM   = 145
RIGHT_EYE_TOP     = 386
RIGHT_EYE_BOTTOM  = 374
NOSE_TIP          = 4
LEFT_CHEEK        = 50
RIGHT_CHEEK       = 280

def _pt(landmarks, idx, w, h):
    lm = landmarks.landmark[idx]
    return np.array([lm.x * w, lm.y * h])

def detect_emotion(frame_bgr=None, bbox=None, landmarks=None, w=640, h=480):
    """
    Landmark-based emotion estimation using MediaPipe face mesh.
    Returns (emotion: str, emotion_score: float, all_emotions: dict)
    """
    if landmarks is None:
        return "neutral", 0.6, {}

    try:
        # ── Mouth curvature (smile detection) ────────────────────────────
        ml = _pt(landmarks, MOUTH_LEFT,   w, h)
        mr = _pt(landmarks, MOUTH_RIGHT,  w, h)
        mt = _pt(landmarks, MOUTH_TOP,    w, h)
        mb = _pt(landmarks, MOUTH_BOTTOM, w, h)

        mouth_width  = np.linalg.norm(mr - ml)
        mouth_height = np.linalg.norm(mb - mt)
        mar = mouth_height / (mouth_width + 1e-6)   # mouth aspect ratio

        # Corner lift = smile indicator
        mouth_center_y = (ml[1] + mr[1]) / 2
        corner_lift = mouth_center_y - mt[1]        # positive = corners up
        smile_score = np.clip(corner_lift / (mouth_width * 0.15 + 1e-6), -1, 1)

        # ── Eye openness ──────────────────────────────────────────────────
        let = _pt(landmarks, LEFT_EYE_TOP,     w, h)
        leb = _pt(landmarks, LEFT_EYE_BOTTOM,  w, h)
        ret = _pt(landmarks, RIGHT_EYE_TOP,    w, h)
        reb = _pt(landmarks, RIGHT_EYE_BOTTOM, w, h)

        left_eye_open  = np.linalg.norm(leb - let)
        right_eye_open = np.linalg.norm(reb - ret)
        avg_eye_open   = (left_eye_open + right_eye_open) / 2
        eye_ratio      = avg_eye_open / (mouth_width * 0.3 + 1e-6)  # normalized

        # ── Brow raise ────────────────────────────────────────────────────
        lb  = _pt(landmarks, LEFT_BROW_INNER,  w, h)
        rb  = _pt(landmarks, RIGHT_BROW_INNER, w, h)
        nt  = _pt(landmarks, NOSE_TIP,         w, h)

        brow_height = nt[1] - (lb[1] + rb[1]) / 2
        brow_raise  = brow_height / (mouth_width + 1e-6)

        # ── Classify emotion ──────────────────────────────────────────────
        if mar > 0.5 and smile_score > 0.1:
            emotion = "surprise"
        elif smile_score > 0.08 and eye_ratio > 0.25:
            emotion = "happy"
        elif smile_score < -0.05 and brow_raise < 1.2:
            emotion = "sad"
        elif smile_score < -0.03 and eye_ratio < 0.2:
            emotion = "angry"
        elif eye_ratio < 0.18:
            emotion = "bored"
        else:
            emotion = "neutral"

        score = EMOTION_SCORES.get(emotion, 0.5)

        # Fake confidence distribution for dashboard
        all_emotions = {
            "happy":    round(max(0, smile_score * 60 + 20), 1),
            "neutral":  round(max(0, 40 - abs(smile_score) * 30), 1),
            "sad":      round(max(0, -smile_score * 40 + 10), 1),
            "surprise": round(max(0, mar * 50), 1),
            "angry":    round(max(0, 10 - eye_ratio * 20), 1),
            "bored":    round(max(0, 15 - eye_ratio * 25), 1),
        }

        return emotion, score, all_emotions

    except Exception:
        return "neutral", 0.6, {}