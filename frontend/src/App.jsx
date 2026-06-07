// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login                from './pages/Login'
import Register             from './pages/Register'
import Dashboard            from './pages/Dashboard'
import Monitor              from './pages/Monitor'
import Analytics            from './pages/Analytics'
import Sessions             from './pages/Sessions'
import Layout               from './components/Layout'
import ClassroomCreate      from './pages/ClassroomCreate'       // ← ADD
import ClassroomJoin        from './pages/ClassroomJoin'         // ← ADD
import TeacherClassroomRoom from './pages/TeacherClassroomRoom'  // ← ADD
import StudentClassroomRoom from './pages/StudentClassroomRoom'  // ← ADD

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#1f2937', color: '#f9fafb', border: '1px solid #374151' }
        }}/>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />

          {/* ── Fullscreen classroom pages (own header, no sidebar Layout) ── */}
          <Route path="/classroom/create"            element={<Protected><ClassroomCreate /></Protected>} />
          <Route path="/classroom/join"              element={<Protected><ClassroomJoin /></Protected>} />
          <Route path="/classroom/:roomCode/teacher" element={<Protected><TeacherClassroomRoom /></Protected>} />
          <Route path="/classroom/:roomCode/student" element={<Protected><StudentClassroomRoom /></Protected>} />

          {/* ── Standard layout pages ── */}
          <Route path="/" element={<Protected><Layout /></Protected>}>
            <Route index            element={<Dashboard />} />
            <Route path="monitor"   element={<Monitor />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="sessions"  element={<Sessions />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}