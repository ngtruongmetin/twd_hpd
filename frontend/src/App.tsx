import './App.css'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import DashboardRedirect from './pages/DashboardRedirect'
import TechAdminDashboard from './pages/tech_admin/Dashboard'
import TechAdminAccounts from './pages/tech_admin/Accounts'
import TwAdminDashboard from './pages/tw_admin/Dashboard'
import ProvinceAdminDashboard from './pages/province_admin/Dashboard'
import JudgeDashboard from './pages/judge/Dashboard'
import ContestantDashboard from './pages/contestant/Dashboard'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<RequireAuth><DashboardRedirect /></RequireAuth>} />
          <Route path="/dashboard/tech_admin" element={<RequireAuth><TechAdminDashboard /></RequireAuth>} />
          <Route path="/dashboard/tech_admin/accounts" element={<RequireAuth><TechAdminAccounts /></RequireAuth>} />
          <Route path="/dashboard/tw_admin" element={<RequireAuth><TwAdminDashboard /></RequireAuth>} />
          <Route path="/dashboard/province_admin" element={<RequireAuth><ProvinceAdminDashboard /></RequireAuth>} />
          <Route path="/dashboard/judge" element={<RequireAuth><JudgeDashboard /></RequireAuth>} />
          <Route path="/dashboard/contestant" element={<RequireAuth><ContestantDashboard /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
