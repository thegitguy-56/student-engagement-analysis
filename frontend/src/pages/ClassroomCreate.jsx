// frontend/src/pages/ClassroomCreate.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClassroom } from "../services/api";

export default function ClassroomCreate() {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Please enter a session title.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await createClassroom(title.trim());
      const room = res.data;
      navigate(`/classroom/${room.room_code}/teacher`);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create classroom.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Create Classroom</h1>
          <p className="text-gray-400 text-sm mt-1">
            A unique room code will be generated for students to join.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Session Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Introduction to Algorithms – Week 4"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:outline-none focus:border-indigo-500 placeholder-gray-600"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Creating…" : "Create & Enter Room"}
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