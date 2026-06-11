import './App.css'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import RequireRole from './components/RequireRole'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import CompleteProfile from './pages/CompleteProfile'
import DashboardRedirect from './pages/DashboardRedirect'
import ForgotPassword from './pages/ForgotPassword'
import TechAdminDashboard from './pages/tech_admin/Dashboard'
import TechAdminAccounts from './pages/tech_admin/Accounts'
import TechAdminSeasons from './pages/tech_admin/Seasons'
import TechAdminOperations from './pages/tech_admin/Operations'
import TechAdminSubmissions from './pages/tech_admin/Submissions'
import TwAdminDashboard from './pages/tw_admin/Dashboard'
import TwAdminUsers from './pages/tw_admin/Users'
import TwAdminSubmissions from './pages/tw_admin/Submissions'
import TwAdminCompetitions from './pages/tw_admin/Competitions'
import ProvinceAdminDashboard from './pages/province_admin/Dashboard'
import ProvinceAdminSubmissions from './pages/province_admin/Submissions'
import JudgeDashboard from './pages/judge/Dashboard'
import JudgeSubmissions from './pages/judge/Submissions'
import ContestantDashboard from './pages/contestant/Dashboard'
import ContestantSubmissions from './pages/contestant/Submissions'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/register" element={<Register />} />
          <Route path="/complete-profile" element={<RequireAuth><CompleteProfile /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><DashboardRedirect /></RequireAuth>} />
          <Route path="/dashboard/tech_admin" element={<RequireRole allowedRoles={['TECH_ADMIN']}><TechAdminDashboard /></RequireRole>} />
          <Route path="/dashboard/tech_admin/accounts" element={<RequireRole allowedRoles={['TECH_ADMIN']}><TechAdminAccounts /></RequireRole>} />
          <Route path="/dashboard/tech_admin/seasons" element={<RequireRole allowedRoles={['TECH_ADMIN']}><TechAdminSeasons /></RequireRole>} />
          <Route path="/dashboard/tech_admin/operations" element={<RequireRole allowedRoles={['TECH_ADMIN']}><TechAdminOperations /></RequireRole>} />
          <Route path="/dashboard/tech_admin/submissions" element={<RequireRole allowedRoles={['TECH_ADMIN']}><TechAdminSubmissions /></RequireRole>} />
          <Route path="/dashboard/tw_admin" element={<RequireRole allowedRoles={['TW_ADMIN']}><TwAdminDashboard /></RequireRole>} />
          <Route path="/dashboard/tw_admin/users" element={<RequireRole allowedRoles={['TW_ADMIN']}><TwAdminUsers /></RequireRole>} />
          <Route path="/dashboard/tw_admin/submissions" element={<RequireRole allowedRoles={['TW_ADMIN']}><TwAdminSubmissions /></RequireRole>} />
          <Route path="/dashboard/tw_admin/competitions" element={<RequireRole allowedRoles={['TW_ADMIN']}><TwAdminCompetitions /></RequireRole>} />
          <Route path="/dashboard/province_admin" element={<RequireRole allowedRoles={['PROVINCE_ADMIN']}><ProvinceAdminDashboard /></RequireRole>} />
          <Route path="/dashboard/province_admin/submissions" element={<RequireRole allowedRoles={['PROVINCE_ADMIN']}><ProvinceAdminSubmissions /></RequireRole>} />
          <Route path="/dashboard/judge" element={<RequireRole allowedRoles={['JUDGE']}><JudgeDashboard /></RequireRole>} />
          <Route path="/dashboard/judge/submissions" element={<RequireRole allowedRoles={['JUDGE']}><JudgeSubmissions /></RequireRole>} />
          <Route path="/dashboard/contestant" element={<RequireRole allowedRoles={['CONTESTANT']}><ContestantDashboard /></RequireRole>} />
          <Route path="/dashboard/contestant/submissions" element={<RequireRole allowedRoles={['CONTESTANT']}><ContestantSubmissions /></RequireRole>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
