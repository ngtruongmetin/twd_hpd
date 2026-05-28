import DashboardShell from '../../components/DashboardShell'
import { getDashboardTitleForRole } from '../../auth/role'
import { useAuth } from '../../context/useAuth'

export default function JudgeDashboard() {
  const { user } = useAuth()

  return <DashboardShell title={getDashboardTitleForRole(user?.role_code)} />
}
