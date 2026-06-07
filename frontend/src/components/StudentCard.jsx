// frontend/src/components/StudentCard.jsx

const EMOTION_EMOJI = {
  happy: "😊", sad: "😞", angry: "😠",
  surprised: "😮", neutral: "😐", fear: "😨", disgust: "🤢",
};

export default function StudentCard({ student }) {
  const { display_name, engagement_score, classification, emotion, alert } = student;

  const scoreColor =
    engagement_score >= 70 ? "text-green-400"
    : engagement_score >= 40 ? "text-yellow-400"
    : "text-red-400";

  const borderColor =
    alert ? "border-red-500 shadow-red-900/40"
    : engagement_score >= 70 ? "border-green-800"
    : engagement_score >= 40 ? "border-yellow-800"
    : "border-red-800";

  const bgColor =
    alert ? "bg-red-950/60"
    : engagement_score >= 70 ? "bg-gray-900"
    : engagement_score >= 40 ? "bg-gray-900"
    : "bg-red-950/30";

  return (
    <div
      className={`rounded-xl border ${borderColor} ${bgColor} p-4 shadow-lg transition-all duration-500 relative`}
    >
      {alert && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold animate-pulse">
          LOW
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-white font-semibold text-sm truncate max-w-[120px]">
            {display_name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{classification}</p>
        </div>
        <span className={`text-2xl font-bold ${scoreColor}`}>
          {Math.round(engagement_score)}
        </span>
      </div>

      {/* Score bar */}
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            engagement_score >= 70 ? "bg-green-500"
            : engagement_score >= 40 ? "bg-yellow-500"
            : "bg-red-500"
          }`}
          style={{ width: `${engagement_score}%` }}
        />
      </div>

      <div className="text-xs text-gray-400">
        {EMOTION_EMOJI[emotion] || "😐"} {emotion}
      </div>
    </div>
  );
}