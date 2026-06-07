// frontend/src/pages/ClassroomJoin.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { joinClassroom } from "../services/api";

export default function ClassroomJoin() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter a room code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await joinClassroom(trimmed);
      navigate(`/classroom/${trimmed}/student`);
    } catch (err) {
      setError(err.response?.data?.detail || "Room not found. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Format as user types: insert hyphen after 3 chars
  const handleCodeChange = (e) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (val.length > 3) val = val.slice(0, 3) + "-" + val.slice(3, 7);
    setCode(val);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Join Classroom</h1>
          <p className="text-gray-400 text-sm mt-1">
            Enter the room code your teacher shared with you.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Room Code
            </label>
            <input
              type="text"
              value={code}
              onChange={handleCodeChange}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="ENG-XXXX"
              maxLength={8}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-700 focus:outline-none focus:border-indigo-500 text-center text-2xl tracking-widest font-mono placeholder-gray-700"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleJoin}
            disabled={loading || code.length < 8}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Joining…" : "Join Room"}
          </button>

          <button
            onClick={() => navigate("/dashboard")}
            className="w-full text-gray-400 hover:text-white text-sm py-1 transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}