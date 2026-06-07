// frontend/src/pages/Dashboard.jsx
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'   // ← add useNavigate
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { Video, TrendingUp, Clock, Smile, ChevronRight, Users, LogIn } from 'lucide-react'  // ← add Users, LogIn
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
ChartJS.register(ArcElement, Tooltip, Legend)

const EMOTION_COLORS = {
  happy:    '#22c55e',
  neutral:  '#6b7280',
  sad:      '#3b82f6',
  surprise: '#f59e0b',
  angry:    '#ef4444',
  disgust:  '#8b5cf6',
  fear:     '#ec4899',
}

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green:  'bg-green-500/10 text-green-400 border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  }
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-2.5 rounded-lg border ${colors[color]}`}>
        <Icon size={20}/>
      </div>
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()   // ← ADD
  const [summary, setSummary]   = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/analytics/summary'),
      api.get('/sessions/'),
    ]).then(([s, sess]) => {
      setSummary(s.data)
      setSessions(sess.data.slice(0, 5))
    }).finally(() => setLoading(false))
  }, [])

  const emotionData = summary?.emotion_distribution
    ? {
        labels: Object.keys(summary.emotion_distribution).map(e => e.charAt(0).toUpperCase() + e.slice(1)),
        datasets: [{
          data: Object.values(summary.emotion_distribution),
          backgroundColor: Object.keys(summary.emotion_distribution).map(e => EMOTION_COLORS[e] || '#6b7280'),
          borderWidth: 0,
          hoverOffset: 4,
        }]
      }
    : null

  const engLevel = summary?.avg_engagement >= 70 ? 'Highly Engaged'
    : summary?.avg_engagement >= 40 ? 'Moderately Engaged' : 'Distracted'

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          {/* ← full_name matches User model */}
          <p className="text-gray-400 text-sm mt-0.5">Welcome back, {user?.full_name}</p>
        </div>
        <Link to="/monitor" className="btn-primary flex items-center gap-2">
          <Video size={16}/> Start Session
        </Link>
      </div>

      {/* ── Classroom quick actions ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {user?.role === 'teacher' && (
          <button
            onClick={() => navigate('/classroom/create')}
            className="flex items-center gap-4 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-xl px-5 py-4 text-left transition-colors"
          >
            <div className="p-2.5 bg-indigo-500/20 rounded-lg">
              <Users size={20} className="text-indigo-400"/>
            </div>
            <div>
              <p className="text-white font-semibold">Create Classroom</p>
              <p className="text-indigo-300 text-xs mt-0.5">Start a live multi-student session</p>
            </div>
          </button>
        )}
        <button
          onClick={() => navigate('/classroom/join')}
          className="flex items-center gap-4 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-xl px-5 py-4 text-left transition-colors"
        >
          <div className="p-2.5 bg-emerald-500/20 rounded-lg">
            <LogIn size={20} className="text-emerald-400"/>
          </div>
          <div>
            <p className="text-white font-semibold">Join Classroom</p>
            <p className="text-emerald-300 text-xs mt-0.5">Enter a room code from your teacher</p>
          </div>
        </button>
      </div>
      {/* ──────────────────────────────────────────────────────────────────── */}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Video}      label="Total sessions"   value={summary?.total_sessions ?? 0}             color="blue"/>
        <StatCard icon={TrendingUp} label="Avg engagement"   value={`${summary?.avg_engagement ?? 0}%`} sub={engLevel} color="green"/>
        <StatCard icon={Clock}      label="Total study time" value={`${Math.round((sessions.reduce((a,s) => a + s.duration_seconds, 0)) / 60)}m`} color="yellow"/>
        <StatCard icon={Smile}      label="Top emotion"      value={Object.entries(summary?.emotion_distribution || {}).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'N/A'} color="purple"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Emotion chart */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Emotion distribution</h2>
          {emotionData ? (
            <div className="flex justify-center">
              <div style={{ width: 180, height: 180 }}>
                <Doughnut data={emotionData} options={{
                  cutout: '65%',
                  plugins: { legend: { display: false }, tooltip: { callbacks: {
                    label: ctx => ` ${ctx.label}: ${ctx.raw}`
                  }}},
                  maintainAspectRatio: false
                }}/>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">No data yet. Start a session!</p>
          )}
          {emotionData && (
            <div className="mt-4 grid grid-cols-2 gap-1">
              {emotionData.labels.map((e, i) => (
                <div key={e} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: emotionData.datasets[0].backgroundColor[i] }}/>
                  {e}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent sessions */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Recent sessions</h2>
            <Link to="/sessions" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View all <ChevronRight size={14}/>
            </Link>
          </div>
          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No sessions yet.</p>
              <Link to="/monitor" className="btn-primary mt-3 inline-flex items-center gap-2 text-sm">
                <Video size={14}/> Start your first session
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => {
                const score = Math.round(s.avg_engagement)
                const badge = score >= 70 ? 'badge-high' : score >= 40 ? 'badge-mid' : 'badge-low'
                const level = score >= 70 ? 'Highly engaged' : score >= 40 ? 'Moderate' : 'Distracted'
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
                    <div className="w-9 h-9 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Video size={16} className="text-blue-400"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">{s.title}</p>
                      <p className="text-xs text-gray-500">{new Date(s.started_at).toLocaleDateString()} · {s.duration_seconds}s</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-bold text-white">{score}%</span>
                      <span className={badge}>{level}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}