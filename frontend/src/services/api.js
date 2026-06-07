// frontend/src/services/api.js
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ── Classroom API helpers ──────────────────────────────────────────────────────
export const createClassroom    = (title)     => api.post('/classroom/create', { title })
export const joinClassroom      = (room_code) => api.post('/classroom/join', { room_code })
export const getClassroom       = (room_code) => api.get(`/classroom/${room_code}`)
export const startClassroom     = (room_code) => api.post(`/classroom/${room_code}/start`)
export const endClassroom       = (room_code) => api.post(`/classroom/${room_code}/end`)
export const getClassroomReport = (room_code) => api.get(`/classroom/${room_code}/report`)