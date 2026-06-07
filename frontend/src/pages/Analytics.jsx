import { useEffect, useState } from 'react'
import api from '../services/api'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, BarElement, ArcElement, LineElement, PointElement,
  CategoryScale, LinearScale, Filler, Tooltip, Legend
} from 'chart.js'
ChartJS.register(BarElement, ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip, Legend)

const EMOTION_COLORS = {
  happy: '#22c55e', neutral: '#6b7280', sad: '#3b82f6',
  surprise: '#f59e0b', angry: '#ef4444', disgust: '#8b5cf6', fear: '#ec4899'
}

export default function Analytics() {
  const [summary, setSummary]   = useState(null)
  const [sessions, setSessions] = useState([])
  const [timeline, setTimeline] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([api.get('/analytics/summary'), api.get('/sessions/')])
      .then(([s, sess]) => {
        setSummary(s.data)
        setSessions(sess.data)
        if (sess.data.length > 0) setSelected(sess.data[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    api.get(`/analytics/session/${selected}/timeline`)
      .then(r => setTimeline(r.data))
      .catch(() => setTimeline([]))
  }, [selected])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>

  // Session comparison bar chart
  const sessionBarData = {
    labels: sessions.slice(0, 10).map((s, i) => `S${i+1}`),
    datasets: [{
      label: 'Avg engagement',
      data: sessions.slice(0, 10).map(s => Math.round(s.avg_engagement)),
      backgroundColor: sessions.slice(0, 10).map(s =>
        s.avg_engagement >= 70 ? 'rgba(34,197,94,0.8)'
        : s.avg_engagement >= 40 ? 'rgba(245,158,11,0.8)'
        : 'rgba(239,68,68,0.8)'
      ),
      borderRadius: 6,
    }]
  }

  // Emotion pie
  const emotionLabels = Object.keys(summary?.emotion_distribution || {})
  const emotionPieData = {
    labels: emotionLabels.map(e => e.charAt(0).toUpperCase() + e.slice(1)),
    datasets: [{
      data: Object.values(summary?.emotion_distribution || {}),
      backgroundColor: emotionLabels.map(e => EMOTION_COLORS[e] || '#6b7280'),
      borderWidth: 0,
      hoverOffset: 6,
    }]
  }

  // Timeline line chart
  const timelineData = {
    labels: timeline.map((_, i) => i),
    datasets: [{
      label: 'Engagement',
      data: timeline.map(t => t.engagement_score),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.1)',
      fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2,
    }]
  }

  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 text-sm mt-0.5">Aggregate insights across all sessions</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          ['Total sessions', summary?.total_sessions ?? 0],
          ['Avg engagement', `${summary?.avg_engagement ?? 0}%`],
          ['Top emotion', Object.entries(summary?.emotion_distribution || {}).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? 'N/A'],
        ].map(([label, val]) => (
          <div key={label} className="card text-center">
            <p className="text-gray-400 text-sm">{label}</p>
            <p className="text-2xl font-bold text-white mt-1 capitalize">{val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Session comparison */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Session comparison (last 10)</h2>
          {sessions.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No sessions yet</p>
          ) : (
            <div style={{ height: 200 }}>
              <Bar data={sessionBarData} options={{
                ...chartDefaults,
                scales: {
                  y: { min: 0, max: 100, grid: { color: '#1f2937' }, ticks: { color: '#6b7280' } },
                  x: { grid: { display: false }, ticks: { color: '#6b7280' } }
                }
              }}/>
            </div>
          )}
        </div>

        {/* Emotion distribution */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Emotion distribution</h2>
          {emotionLabels.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No data yet</p>
          ) : (
            <div className="flex items-center gap-6">
              <div style={{ width: 160, height: 160 }}>
                <Doughnut data={emotionPieData} options={{ ...chartDefaults, cutout: '60%' }}/>
              </div>
              <div className="space-y-1.5">
                {emotionLabels.map((e, i) => (
                  <div key={e} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full" style={{ background: EMOTION_COLORS[e] || '#6b7280' }}/>
                    <span className="text-gray-300 capitalize">{e}</span>
                    <span className="text-gray-500 ml-auto">{summary.emotion_distribution[e]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session timeline */}
      {sessions.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Session timeline</h2>
            <select value={selected || ''} onChange={e => setSelected(e.target.value)}
              className="input py-1.5 text-sm w-48">
              {sessions.map((s, i) => (
                <option key={s.id} value={s.id}>Session {i+1} – {s.title}</option>
              ))}
            </select>
          </div>
          {timeline.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No timeline data for this session</p>
          ) : (
            <div style={{ height: 200 }}>
              <Line data={timelineData} options={{
                ...chartDefaults,
                scales: {
                  y: { min: 0, max: 100, grid: { color: '#1f2937' }, ticks: { color: '#6b7280' } },
                  x: { display: false }
                }
              }}/>
            </div>
          )}
        </div>
      )}
    </div>
  )
}