import { useEffect, useState } from 'react'
import api from '../services/api'
import { Link } from 'react-router-dom'
import { Video, Download, Clock, TrendingUp, Trash2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Confirm-delete modal ────────────────────────────────────────────────────
function DeleteModal({ session, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-500/15 rounded-xl">
            <AlertTriangle size={20} className="text-red-400"/>
          </div>
          <div>
            <h2 className="text-white font-semibold">Delete session?</h2>
            <p className="text-gray-400 text-xs mt-0.5">This cannot be undone</p>
          </div>
        </div>
        <div className="bg-gray-800/60 rounded-xl px-4 py-3 text-sm">
          <p className="text-gray-200 font-medium truncate">{session.title}</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {new Date(session.started_at).toLocaleDateString()} · {session.total_frames} frames stored
          </p>
        </div>
        <p className="text-gray-400 text-sm">
          All engagement records and analytics for this session will be permanently deleted, freeing up storage on Neon.
        </p>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 size={14}/> Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function Sessions() {
  const [sessions, setSessions]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [toDelete, setToDelete]     = useState(null)   // session object pending deletion
  const [deleting, setDeleting]     = useState(false)

  const fetchSessions = () => {
    api.get('/sessions/').then(r => {
      // Filter out orphaned sessions (active + 0 frames = never properly ended)
      const valid = r.data.filter(s => !(s.status === 'active' && s.total_frames === 0))
      setSessions(valid)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchSessions() }, [])

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

  const confirmDelete = async () => {
    if (!toDelete || deleting) return
    setDeleting(true)
    try {
      await api.delete(`/sessions/${toDelete.id}`)
      setSessions(prev => prev.filter(s => s.id !== toDelete.id))
      toast.success('Session deleted')
    } catch {
      toast.error('Failed to delete session')
    } finally {
      setDeleting(false)
      setToDelete(null)
    }
  }

  const formatDuration = (secs) => {
    if (!secs || secs < 60) return `${secs || 0}s`
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return s > 0 ? `${m}m ${s}s` : `${m}m`
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <>
      {/* Delete confirmation modal */}
      {toDelete && (
        <DeleteModal
          session={toDelete}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Sessions</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {sessions.length} completed session{sessions.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
          <Link to="/monitor" className="btn-primary flex items-center gap-2">
            <Video size={16}/> New session
          </Link>
        </div>

        {sessions.length === 0 ? (
          <div className="card text-center py-16">
            <Video size={40} className="text-gray-600 mx-auto mb-3"/>
            <p className="text-gray-400">No completed sessions yet.</p>
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
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Frames</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Avg score</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                  <th className="px-4 py-3 text-right text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sessions.map(s => {
                  const score    = Math.round(s.avg_engagement)
                  const engBadge = score >= 70 ? 'badge-high' : score >= 40 ? 'badge-mid' : 'badge-low'
                  const engLabel = score >= 70 ? 'High' : score >= 40 ? 'Moderate' : 'Low'
                  const isCompleted = s.status === 'completed'
                  const hasData     = s.total_frames > 0
                  return (
                    <tr key={s.id} className="hover:bg-gray-800/30 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Video size={14} className="text-blue-400"/>
                          </div>
                          <span className="font-medium text-gray-200 truncate max-w-[160px]">{s.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(s.started_at).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12}/>{formatDuration(s.duration_seconds)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{s.total_frames}</td>
                      <td className="px-4 py-3">
                        {isCompleted && hasData ? (
                          <span className="flex items-center gap-1 font-bold text-white">
                            <TrendingUp size={12} className="text-blue-400"/>{score}%
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isCompleted
                          ? <span className={hasData ? engBadge : 'badge-low'}>{hasData ? engLabel : 'No data'}</span>
                          : <span className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded-full">Active</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {isCompleted && hasData && (
                            <button
                              onClick={() => downloadReport(s.id)}
                              className="text-gray-500 hover:text-blue-400 transition-colors flex items-center gap-1 text-xs opacity-0 group-hover:opacity-100"
                              title="Download PDF report"
                            >
                              <Download size={14}/> PDF
                            </button>
                          )}
                          <button
                            onClick={() => setToDelete(s)}
                            className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-400/10"
                            title="Delete session"
                          >
                            <Trash2 size={15}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}