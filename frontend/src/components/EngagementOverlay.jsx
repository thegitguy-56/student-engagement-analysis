// frontend/src/components/EngagementOverlay.jsx
import { useEffect, useRef, useState } from "react";
import { StudentClassroomSocket } from "../services/classroomSocket";

const EMOTION_EMOJI = {
  happy: "😊", sad: "😞", angry: "😠", surprised: "😮",
  neutral: "😐", fear: "😨", disgust: "🤢",
};

const CLASSIFICATION_COLOR = {
  "Highly Engaged":     "text-green-400",
  "Moderately Engaged": "text-yellow-400",
  "Distracted":         "text-red-400",
  "Unknown":            "text-gray-400",
};

export default function EngagementOverlay({ roomCode, userId, stream }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const intervalRef = useRef(null);

  const [score, setScore] = useState(null);
  const [classification, setClassification] = useState("Connecting…");
  const [emotion, setEmotion] = useState("neutral");

  useEffect(() => {
    // Attach the shared stream to the hidden video element
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }

    // Connect WebSocket
    socketRef.current = new StudentClassroomSocket(
      roomCode,
      userId,
      (msg) => {
        setScore(msg.engagement_score);
        setClassification(msg.classification);
        setEmotion(msg.emotion);
      }
    );
    socketRef.current.connect();

    // Capture frames every 500ms from the shared stream
    intervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const ctx = canvas.getContext("2d");
      canvas.width = 320;
      canvas.height = 240;
      ctx.drawImage(video, 0, 0, 320, 240);
      const base64 = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
      socketRef.current?.sendFrame(base64);
    }, 500);

    return () => {
      clearInterval(intervalRef.current);
      socketRef.current?.disconnect();
      // Do NOT stop stream tracks here — parent owns the stream
    };
  }, [roomCode, userId, stream]);

  const scoreColor =
    score === null    ? "text-gray-400"
    : score >= 70    ? "text-green-400"
    : score >= 40    ? "text-yellow-400"
    : "text-red-400";

  if (!stream) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 text-center text-red-400 text-sm w-64">
        Camera unavailable
      </div>
    );
  }

  return (
    <div className="relative w-64">
      <video ref={videoRef} autoPlay muted playsInline className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-lg">
        <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Your Engagement
          </span>
          <span className={`text-lg font-bold ${scoreColor}`}>
            {score === null ? "—" : score}
          </span>
        </div>

        <div className="px-4 py-3 space-y-1">
          <div className={`text-sm font-semibold ${CLASSIFICATION_COLOR[classification] || "text-gray-400"}`}>
            {classification}
          </div>
          <div className="text-xs text-gray-400 flex items-center gap-1">
            {EMOTION_EMOJI[emotion] || "😐"} {emotion}
          </div>
        </div>

        {score !== null && (
          <div className="px-4 pb-3">
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500"
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}