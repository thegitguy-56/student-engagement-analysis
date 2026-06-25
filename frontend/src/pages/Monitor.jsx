import { useRef, useState, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { EngagementWebSocket } from '../services/websocket'
import toast from 'react-hot-toast'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale,
  CategoryScale, Filler, Tooltip
} from 'chart.js'
import {
  Play, Square, Eye, EyeOff, User, UserX,
  Smile, AlertCircle, Hand, Meh
} from 'lucide-react'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

const EMOTION_EMOJI = {
  happy: '😊', neutral: '😐', sad: '😢',
  surprise: '😮', angry: '😠', disgust: '🤢', fear: '😨'
}

const WEBCAM_CONSTRAINTS = {
  width: 640, height: 480,
  facingMode: 'user',
}

function MetricPill({ icon: Icon, label, value, active }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
      active
        ? 'bg-green-500/10 border-green-500/30 text-green-400'
        : 'bg-gray-800 border-gray-700 text-gray-400'
    }`}>
      <Icon size={14} className="flex-shrink-0"/>
      <div>
        <p className="text-xs opacity-70">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  )
}

function ScoreRing({ score }) {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  const r = 54, circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#1f2937" strokeWidth="10"/>
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-bold text-white">{Math.round(score)}</p>
        <p className="text-xs text-gray-400">/ 100</p>
      </div>
    </div>
  )
}

export default function Monitor() {
  const webcamRef   = useRef(null)
  const wsRef       = useRef(null)
  const intervalRef = useRef(null)
  const sessionIdRef = useRef(null)   // track session id in ref for cleanup
  const navigate    = useNavigate()

  const [sessionId, setSessionId]       = useState(null)
  const [running, setRunning]           = useState(false)
  const [starting, setStarting]         = useState(false)   // guard against double-click
  const [metrics, setMetrics]           = useState(null)
  const [scores, setScores]             = useState([])
  const [timestamps, setTimestamps]     = useState([])
  const [frameCount, setFrameCount]     = useState(0)
  const [elapsed, setElapsed]           = useState(0)
  const [title, setTitle]               = useState('Learning Session')

  // Timer
  useEffect(() => {
    let timer
    if (running) timer = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timer)
  }, [running])

  // Auto-end session if user navigates away without stopping
  useEffect(() => {
    return () => {
      const sid = sessionIdRef.current
      if (sid) {
        clearInterval(intervalRef.current)
        wsRef.current?.disconnect()
        // Fire-and-forget: end the session in the background
        api.patch(`/sessions/${sid}/end`).catch(() => {})
      }
    }
  }, [])

  const formatTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  const handleWsMessage = useCallback((data) => {
    setMetrics(data)
    setFrameCount(data.frame_count || 0)
    setScores(prev => [...prev.slice(-29), data.engagement_score])
    setTimestamps(prev => [...prev.slice(-29), new Date().toLocaleTimeString()])
  }, [])

  const startSession = async () => {
    if (starting || running) return   // prevent double-start
    setStarting(true)
    try {
      const res = await api.post('/sessions/', { title })
      const sid = res.data.id
      setSessionId(sid)
      sessionIdRef.current = sid       // keep ref in sync for cleanup
      setRunning(true)
      setScores([])
      setTimestamps([])
      setElapsed(0)

      const ws = new EngagementWebSocket(sid, handleWsMessage, () => {
        toast.error('Connection lost')
        setRunning(false)
      })
      ws.connect()
      wsRef.current = ws

      // Capture + send frame every 500ms
      intervalRef.current = setInterval(() => {
        const imgSrc = webcamRef.current?.getScreenshot()
        if (imgSrc) {
          const b64 = imgSrc.replace(/^data:image\/\w+;base64,/, '')
          wsRef.current?.sendFrame(b64)
        }
      }, 500)

      toast.success('Session started!')
    } catch (e) {
      toast.error('Failed to start session')
    } finally {
      setStarting(false)
    }
  }

  const stopSession = async () => {
    clearInterval(intervalRef.current)
    wsRef.current?.disconnect()
    sessionIdRef.current = null   // clear so unmount cleanup doesn't double-end
    if (sessionId) {
      await api.patch(`/sessions/${sessionId}/end`).catch(() => {})
    }
    setRunning(false)
    toast.success('Session saved!')
    navigate('/sessions')
  }

  const chartData = {
    labels: timestamps,
    datasets: [{
      data: scores,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2,
    }]
  }
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { min: 0, max: 100, grid: { color: '#1f2937' }, ticks: { color: '#6b7280', stepSize: 25 } },
      x: { display: false }
    },
    plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
    animation: { duration: 300 }
  }

  const level = metrics?.engagement_level || 'distracted'
  const levelBadge = level === 'highly_engaged' ? 'badge-high'
    : level === 'moderately_engaged' ? 'badge-mid' : 'badge-low'
  const levelLabel = level === 'highly_engaged' ? 'Highly Engaged'
    : level === 'moderately_engaged' ? 'Moderately Engaged' : 'Distracted'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Monitor</h1>
          <p className="text-gray-400 text-sm mt-0.5">Real-time engagement analysis via webcam</p>
        </div>
        <div className="flex items-center gap-2">
          {running && (
            <span className="flex items-center gap-1.5 text-sm text-gray-400 bg-gray-800 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"/>
              {formatTime(elapsed)} · {frameCount} frames
            </span>
          )}
          {!running ? (
            <div className="flex items-center gap-2">
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="input w-48 text-sm py-1.5" placeholder="Session title"/>
              <button
                onClick={startSession}
                disabled={starting}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {starting
                  ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> Starting…</>
                  : <><Play size={16}/> Start</>
                }
              </button>
            </div>
          ) : (
            <button onClick={stopSession} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
              <Square size={16}/> End session
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Webcam feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-0 overflow-hidden relative">
            <Webcam
              ref={webcamRef}
              videoConstraints={WEBCAM_CONSTRAINTS}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.6}
              className="w-full"
              mirrored
            />
            {/* Overlay badges */}
            {metrics && (
              <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                <span className={levelBadge}>{levelLabel}</span>
                <span className="bg-gray-900/80 text-gray-300 text-xs px-2 py-0.5 rounded-full border border-gray-700">
                  {EMOTION_EMOJI[metrics.emotion] || '😐'} {metrics.emotion}
                </span>
                <span className="bg-gray-900/80 text-gray-300 text-xs px-2 py-0.5 rounded-full border border-gray-700">
                  👁 {metrics.head_pose}
                </span>
              </div>
            )}
            {!running && (
              <div className="absolute inset-0 bg-gray-950/60 flex items-center justify-center">
                <p className="text-gray-300 text-sm">Click <strong>Start</strong> to begin session</p>
              </div>
            )}
          </div>

          {/* Score trend chart */}
          <div className="card">
            <p className="text-sm font-medium text-gray-300 mb-3">Engagement trend</p>
            <div style={{ height: 100 }}>
              <Line data={chartData} options={chartOptions}/>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Score ring */}
          <div className="card flex flex-col items-center py-6">
            <p className="text-sm text-gray-400 mb-3">Engagement score</p>
            <ScoreRing score={metrics?.engagement_score ?? 0}/>
            <span className={`mt-3 ${levelBadge}`}>{levelLabel}</span>
          </div>

          {/* Detection pills */}
          <div className="card">
            <p className="text-sm font-medium text-gray-300 mb-3">Detection signals</p>
            <div className="grid grid-cols-2 gap-2">
              <MetricPill icon={metrics?.face_present ? User : UserX}
                label="Face" value={metrics?.face_present ? 'Present' : 'Absent'}
                active={!!metrics?.face_present}/>
              <MetricPill icon={metrics?.eye_contact ? Eye : EyeOff}
                label="Gaze" value={metrics?.eye_contact ? 'On screen' : 'Away'}
                active={!!metrics?.eye_contact}/>
              <MetricPill icon={Smile} label="Emotion"
                value={`${EMOTION_EMOJI[metrics?.emotion] || '😐'} ${metrics?.emotion || 'N/A'}`}
                active={metrics?.emotion === 'happy'}/>
              <MetricPill icon={Meh} label="Head"
                value={metrics?.head_pose || 'N/A'}
                active={metrics?.head_pose === 'center'}/>
              <MetricPill icon={AlertCircle} label="Yawning"
                value={metrics?.yawning ? 'Yes' : 'No'}
                active={!metrics?.yawning}/>
              <MetricPill icon={Hand} label="Hand raise"
                value={metrics?.hand_raised ? 'Raised!' : 'No'}
                active={!!metrics?.hand_raised}/>
            </div>
          </div>

          {/* Component breakdown */}
          {metrics && (
            <div className="card">
              <p className="text-sm font-medium text-gray-300 mb-3">Score breakdown</p>
              <div className="space-y-2">
                {[
                  ['Face', metrics.face_score, 0.20],
                  ['Gaze', metrics.gaze_score, 0.25],
                  ['Head pose', metrics.pose_score, 0.20],
                  ['Emotion', metrics.emotion_score, 0.20],
                  ['Alertness', metrics.yawn_score, 0.10],
                  ['Participation', metrics.hand_score, 0.05],
                ].map(([label, score, weight]) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                      <span>{label}</span>
                      <span>{Math.round(score * 100)}% <span className="text-gray-600">× {weight}</span></span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${score * 100}%`}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}