import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGuard } from './components/auth/AuthGuard'
import { LoginPage } from './components/auth/LoginPage'
import { ProjectDashboard } from './components/project/ProjectDashboard'
import { ProjectWorkspace } from './components/project/ProjectWorkspace'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected */}
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <ProjectDashboard />
          </AuthGuard>
        }
      />
      <Route
        path="/project/:id"
        element={
          <AuthGuard>
            <ProjectWorkspace />
          </AuthGuard>
        }
      />

      {/* Fallback */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
