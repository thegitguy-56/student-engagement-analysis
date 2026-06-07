// frontend/src/pages/StudentClassroomRoom.jsx
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getClassroom } from "../services/api";
import EngagementOverlay from "../components/EngagementOverlay";

export default function StudentClassroomRoom() {
  const { roomCode } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [cameraStream, setCameraStream] = useState(null);  // ← shared stream
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    getClassroom(roomCode).then((r) => setRoom(r.data)).catch(console.error);
  }, [roomCode]);

  // Step 1: acquire camera ONCE here, before Jitsi loads
  useEffect(() => {
    let stream = null;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      .then((s) => {
        stream = s;
        setCameraStream(s);
        setCameraReady(true);
      })
      .catch((err) => {
        console.warn("Camera unavailable:", err);
        setCameraReady(true); // still proceed, overlay will show error
      });

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Step 2: load Jitsi AFTER camera stream is obtained
  useEffect(() => {
    if (!cameraReady) return; // wait until we've attempted camera first

    const loadJitsi = () => {
      if (!jitsiContainerRef.current) return;
      const options = {
        roomName: `EngagementAnalysis-${roomCode}`,
        width: "100%",
        height: "100%",
        parentNode: jitsiContainerRef.current,
        userInfo: { displayName: user.username || user.full_name },
        configOverwrite: {
          startWithAudioMuted: false,
          startScreenSharing: false,
          // Tell Jitsi to use the same camera device we already opened
          // so the browser reuses the track instead of opening a new one
          cameraDeviceId: cameraStream?.getVideoTracks()[0]
            ?.getSettings()?.deviceId,
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: ["microphone", "camera", "hangup", "chat", "raisehand"],
          SHOW_JITSI_WATERMARK: false,
          DEFAULT_BACKGROUND: "#111827",
        },
      };
      jitsiApiRef.current = new window.JitsiMeetExternalAPI("meet.jit.si", options);
      jitsiApiRef.current.addEventListener("readyToClose", () => {
        navigate("/dashboard");
      });
    };

    if (window.JitsiMeetExternalAPI) {
      loadJitsi();
    } else {
      const script = document.createElement("script");
      script.src = "https://meet.jit.si/external_api.js";
      script.async = true;
      script.onload = loadJitsi;
      document.body.appendChild(script);
    }

    return () => jitsiApiRef.current?.dispose();
  }, [cameraReady, roomCode, user, navigate, cameraStream]);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-white font-semibold">
            {room?.title || roomCode}
          </h1>
          <p className="text-gray-500 text-xs font-mono">{roomCode}</p>
        </div>
        <button
          onClick={() => setShowOverlay((v) => !v)}
          className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-1 transition-colors"
        >
          {showOverlay ? "Hide" : "Show"} Engagement
        </button>
      </header>

      <div className="relative flex-1">
        <div className="absolute inset-0" ref={jitsiContainerRef} />

        {showOverlay && cameraReady && (
          <div className="absolute bottom-6 right-6 z-10">
            {/* Pass the already-opened stream down — no second getUserMedia call */}
            <EngagementOverlay
              roomCode={roomCode}
              userId={user.id}
              stream={cameraStream}   // ← new prop
            />
          </div>
        )}
      </div>
    </div>
  );
}