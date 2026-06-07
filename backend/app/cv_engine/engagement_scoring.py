"""
Engagement Score Formula (0–100):

  face_score    × 0.20   → Is the student in frame?
  gaze_score    × 0.25   → Is the student looking at the screen?
  pose_score    × 0.20   → Is the head centered/forward?
  emotion_score × 0.20   → Is the emotion positive/engaged?
  yawn_score    × 0.10   → Is the student alert (not yawning)?
  hand_score    × 0.05   → Is the student participating?
                ──────
                  1.00   total weight
"""

WEIGHTS = {
    "face":    0.20,
    "gaze":    0.25,
    "pose":    0.20,
    "emotion": 0.20,
    "yawn":    0.10,
    "hand":    0.05,
}

def compute_engagement_score(
    face_score: float,
    gaze_score: float,
    pose_score: float,
    emotion_score: float,
    yawn_score: float,
    hand_score: float,
    face_present: bool,
) -> tuple[float, str]:
    """
    Returns (engagement_score: float 0-100, engagement_level: str)
    """
    # If no face detected, score is 0
    if not face_present:
        return 0.0, "distracted"

    raw = (
        face_score    * WEIGHTS["face"]    +
        gaze_score    * WEIGHTS["gaze"]    +
        pose_score    * WEIGHTS["pose"]    +
        emotion_score * WEIGHTS["emotion"] +
        yawn_score    * WEIGHTS["yawn"]    +
        hand_score    * WEIGHTS["hand"]
    )

    score = round(raw * 100, 1)
    score = max(0.0, min(100.0, score))

    if score >= 70:
        level = "highly_engaged"
    elif score >= 40:
        level = "moderately_engaged"
    else:
        level = "distracted"

    return score, level