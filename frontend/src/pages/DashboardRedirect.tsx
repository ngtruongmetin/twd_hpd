import { Navigate } from 'react-router-dom'
import { getDashboardPathForRole } from '../auth/role'
import { useAuth } from '../context/useAuth'

export default function DashboardRedirect() {
  const { user } = useAuth()

  return <Navigate to={getDashboardPathForRole(user?.role_code)} replace />
}
