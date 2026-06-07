import mediapipe as mp
import numpy as np

mp_face_mesh = mp.solutions.face_mesh

class FaceDetector:
    def __init__(self):
        self.face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

    def detect(self, frame_rgb):
        results = self.face_mesh.process(frame_rgb)
        if not results.multi_face_landmarks:
            return False, None, None

        landmarks = results.multi_face_landmarks[0]
        h, w = frame_rgb.shape[:2]

        xs = [lm.x * w for lm in landmarks.landmark]
        ys = [lm.y * h for lm in landmarks.landmark]
        x1, y1 = int(min(xs)), int(min(ys))
        x2, y2 = int(max(xs)), int(max(ys))
        bbox = (x1, y1, x2, y2)

        return True, landmarks, bbox