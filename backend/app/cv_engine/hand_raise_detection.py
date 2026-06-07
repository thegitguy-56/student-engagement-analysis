import mediapipe as mp
import numpy as np

mp_hands = mp.solutions.hands

class HandRaiseDetector:
    def __init__(self):
        self.hands = mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

    def detect(self, frame_rgb):
        try:
            results = self.hands.process(frame_rgb)
            if not results.multi_hand_landmarks:
                return False, 0.0, 0.0

            for hand_landmarks in results.multi_hand_landmarks:
                wrist_y = hand_landmarks.landmark[0].y
                tip_y   = hand_landmarks.landmark[12].y
                if wrist_y < 0.45 and tip_y < wrist_y:
                    return True, 1.0, round(1.0 - wrist_y, 3)

            return False, 0.0, 0.0
        except Exception:
            return False, 0.0, 0.0