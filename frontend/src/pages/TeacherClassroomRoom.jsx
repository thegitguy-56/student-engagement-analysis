// frontend/src/pages/TeacherClassroomRoom.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getClassroom, startClassroom, endClassroom } from "../services/api";
import { TeacherClassroomSocket } from "../services/classroomSocket";
import StudentCard from "../components/StudentCard";

const JITSI_DOMAIN = import.meta.env.VITE_JITSI_DOMAIN || "meet.ffmuc.net";

export default function TeacherClassroomRoom() {
  const { roomCode } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const socketRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState("waiting");
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);

  // Load room info
  useEffect(() => {
    getClassroom(roomCode).then((res) => setRoom(res.data)).catch(console.error);
  }, [roomCode]);

  // Teacher WS
  useEffect(() => {
    socketRef.current = new TeacherClassroomSocket(
      roomCode,
      user.id,
      (snap) => setSnapshot(snap)
    );
    socketRef.current.connect();
    return () => socketRef.current?.disconnect();
  }, [roomCode, user.id]);

  // Load Jitsi script once and create meeting
  useEffect(() => {
    const loadJitsi = () => {
      if (!jitsiContainerRef.current) return;

      const domain = JITSI_DOMAIN;
      const options = {
        roomName: `EngagementAnalysis-${roomCode}`,
        width: "100%",
        height: "100%",
        parentNode: jitsiContainerRef.current,
        userInfo: { displayName: user.username },
        configOverwrite: {
          startWithAudioMuted: false,
          disableModeratorIndicator: true,
          startScreenSharing: false,
          enableEmailInStats: false,
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: ["microphone", "camera", "hangup", "chat", "raisehand", "participants-pane"],
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          DEFAULT_BACKGROUND: "#111827",
        },
      };

      jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options);
    };

    if (window.JitsiMeetExternalAPI) {
      loadJitsi();
    } else {
      const script = document.createElement("script");
      script.src = `https://${JITSI_DOMAIN}/external_api.js`;
      script.async = true;
      script.onload = loadJitsi;
      document.body.appendChild(script);
    }

    return () => {
      jitsiApiRef.current?.dispose();
    };
  }, [roomCode, user.username]);

  const handleStart = async () => {
    await startClassroom(roomCode);
    setStatus("active");
  };

  const handleEnd = async () => {
    if (!confirm("End this session for all students?")) return;
    setEnding(true);
    await endClassroom(roomCode);
    jitsiApiRef.current?.dispose();
    navigate("/dashboard");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const students = snapshot?.students || [];
  const activeStudents = students.filter((s) => s.last_update > Date.now() / 1000 - 10);
  const alerts = students.filter((s) => s.alert);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-white font-bold text-lg">
            {room?.title || roomCode}
          </h1>
          <button
            onClick={copyCode}
            className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm px-3 py-1 rounded-lg font-mono transition-colors flex items-center gap-1.5"
          >
            {roomCode}
            <span className="text-gray-500">{copied ? "✓" : "📋"}</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {status === "waiting" && (
            <button
              onClick={handleStart}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
            >
              Start Session
            </button>
          )}
          <button
            onClick={handleEnd}
            disabled={ending}
            className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
          >
            {ending ? "Ending…" : "End Session"}
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Jitsi video */}
        <div className="flex-1 min-h-0" ref={jitsiContainerRef} />

        {/* Sidebar: student dashboard */}
        <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
          {/* Stats row */}
          <div className="px-4 py-3 border-b border-gray-800 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xl font-bold text-white">
                {snapshot?.student_count ?? 0}
              </div>
              <div className="text-xs text-gray-500">Online</div>
            </div>
            <div>
              <div className={`text-xl font-bold ${
                (snapshot?.class_average ?? 0) >= 70 ? "text-green-400"
                : (snapshot?.class_average ?? 0) >= 40 ? "text-yellow-400"
                : "text-red-400"
              }`}>
                {snapshot?.class_average ?? "—"}
              </div>
              <div className="text-xs text-gray-500">Avg Score</div>
            </div>
            <div>
              <div className={`text-xl font-bold ${alerts.length > 0 ? "text-red-400" : "text-gray-500"}`}>
                {alerts.length}
              </div>
              <div className="text-xs text-gray-500">Alerts</div>
            </div>
          </div>

          {/* Alert banner */}
          {alerts.length > 0 && (
            <div className="mx-3 mt-3 bg-red-900/60 border border-red-700 rounded-lg px-3 py-2">
              <p className="text-red-300 text-xs font-semibold mb-1">
                ⚠ Low engagement detected
              </p>
              {alerts.map((s) => (
                <p key={s.user_id} className="text-red-200 text-xs">
                  {s.display_name}
                </p>
              ))}
            </div>
          )}

          {/* Student grid */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {students.length === 0 ? (
              <div className="text-center text-gray-600 text-sm pt-12">
                <p className="text-3xl mb-2">🎓</p>
                <p>Waiting for students…</p>
                <p className="text-xs mt-1">Share code: <span className="font-mono text-indigo-400">{roomCode}</span></p>
              </div>
            ) : (
              students.map((student) => (
                <StudentCard key={student.user_id} student={student} />
              ))
            )}
          </div>

          {/* Engagement heatmap legend */}
          <div className="px-4 py-2 border-t border-gray-800">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;40
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> 40–70
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> 70+
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}