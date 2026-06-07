const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

export class EngagementWebSocket {
  constructor(sessionId, onMessage, onClose) {
    this.sessionId = sessionId
    this.onMessage = onMessage
    this.onClose   = onClose
    this.ws        = null
    this.active    = false
  }

  connect() {
    const token = localStorage.getItem('token')
    this.ws = new WebSocket(`${WS_BASE}/api/sessions/ws/${this.sessionId}?token=${token}`)

    this.ws.onopen    = () => { this.active = true }
    this.ws.onmessage = e  => { this.onMessage(JSON.parse(e.data)) }
    this.ws.onclose   = () => { this.active = false; this.onClose?.() }
    this.ws.onerror   = e  => console.error('WS error', e)
  }

  sendFrame(base64Frame) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ frame: base64Frame }))
    }
  }

  disconnect() {
    this.active = false
    this.ws?.close()
  }
}