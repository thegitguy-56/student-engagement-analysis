import { useEffect, useState } from 'react'
import api from '../services/api'
import { Link } from 'react-router-dom'
import { Video, Download, Clock, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Sessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    api.get('/sessions/').then(r => setSessions(r.data)).finally(() => setLoading(false))
  }, [])

  const downloadReport = async (id) => {
    try {
      const res = await api.get(`/reports/${id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = `session-${id.slice(0,8)}-report.pdf`; a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded!')
    } catch {
      toast.error('Failed to generate report')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
          <p className="text-gray-400 text-sm mt-0.5">{sessions.length} total sessions recorded</p>
        </div>
        <Link to="/monitor" className="btn-primary flex items-center gap-2">
          <Video size={16}/> New session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="card text-center py-16">
          <Video size={40} className="text-gray-600 mx-auto mb-3"/>
          <p className="text-gray-400">No sessions yet.</p>
          <Link to="/monitor" className="btn-primary mt-4 inline-flex items-center gap-2">
            <Video size={14}/> Start your first session
          </Link>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Session</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Duration</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Avg score</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sessions.map(s => {
                const score = Math.round(s.avg_engagement)
                const badge = score >= 70 ? 'badge-high' : score >= 40 ? 'badge-mid' : 'badge-low'
                const level = score >= 70 ? 'High' : score >= 40 ? 'Moderate' : 'Low'
                return (
                  <tr key={s.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                          <Video size={14} className="text-blue-400"/>
                        </div>
                        <span className="font-medium text-gray-200">{s.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{new Date(s.started_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-gray-400">
                      <span className="flex items-center gap-1"><Clock size={12}/>{s.duration_seconds}s</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 font-bold text-white">
                        <TrendingUp size={12} className="text-blue-400"/>{score}%
                      </span>
                    </td>
                    <td className="px-4 py-3"><span className={badge}>{level}</span></td>
                    <td className="px-4 py-3">
                      <button onClick={() => downloadReport(s.id)}
                        className="text-gray-500 hover:text-blue-400 transition-colors flex items-center gap-1 text-xs">
                        <Download size={14}/> PDF
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}