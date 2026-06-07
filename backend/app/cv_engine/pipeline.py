import cv2
import numpy as np

from .face_detection       import FaceDetector
from .gaze_tracking        import compute_gaze
from .head_pose            import estimate_head_pose
from .emotion_detection    import detect_emotion
from .yawn_detection       import detect_yawn
from .hand_raise_detection import HandRaiseDetector
from .engagement_scoring   import compute_engagement_score

_face_detector = None
_hand_detector = None

def _get_detectors():
    global _face_detector, _hand_detector
    if _face_detector is None:
        _face_detector = FaceDetector()
    if _hand_detector is None:
        _hand_detector = HandRaiseDetector()
    return _face_detector, _hand_detector


def process_frame(frame_bgr: np.ndarray) -> dict:
    face_det, hand_det = _get_detectors()
    h, w = frame_bgr.shape[:2]
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

    # 1. Face
    face_present, landmarks, bbox = face_det.detect(frame_rgb)
    face_score = 1.0 if face_present else 0.0

    # 2. Gaze
    if face_present and landmarks:
        eye_contact, gaze_score, gaze_dir = compute_gaze(landmarks, w, h)
    else:
        eye_contact, gaze_score, gaze_dir = False, 0.0, "unknown"

    # 3. Head pose
    if face_present and landmarks:
        head_pose, pose_score, yaw, pitch = estimate_head_pose(landmarks, w, h)
    else:
        head_pose, pose_score, yaw, pitch = "unknown", 0.0, 0.0, 0.0

    # 4. Emotion — now uses landmarks directly (no TensorFlow!)
    if face_present and landmarks:
        emotion, emotion_score, all_emotions = detect_emotion(
            landmarks=landmarks, w=w, h=h
        )
    else:
        emotion, emotion_score, all_emotions = "neutral", 0.5, {}

    # 5. Yawn
    if face_present and landmarks:
        yawning, yawn_score, mar = detect_yawn(landmarks, w, h)
    else:
        yawning, yawn_score, mar = False, 1.0, 0.0

    # 6. Hand raise
    hand_raised, hand_score, hand_conf = hand_det.detect(frame_rgb)

    # 7. Final score
    engagement_score, engagement_level = compute_engagement_score(
        face_score, gaze_score, pose_score, emotion_score,
        yawn_score, hand_score, face_present
    )

    return {
        "face_present":     face_present,
        "eye_contact":      eye_contact,
        "head_pose":        head_pose,
        "emotion":          emotion,
        "yawning":          yawning,
        "hand_raised":      hand_raised,
        "face_score":       face_score,
        "gaze_score":       gaze_score,
        "pose_score":       pose_score,
        "emotion_score":    emotion_score,
        "yawn_score":       yawn_score,
        "hand_score":       hand_score,
        "engagement_score": engagement_score,
        "engagement_level": engagement_level,
        "all_emotions":     all_emotions,
        "gaze_direction":   gaze_dir,
        "yaw":              yaw,
        "pitch":            pitch,
        "mar":              mar,
    }