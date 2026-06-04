import { Navigate, useLocation } from 'react-router-dom'
import { getDashboardPathForRole, isProfileCompleted, type RoleCode } from '../auth/role'
import { useAuth } from '../context/useAuth'

type RequireRoleProps = {
  allowedRoles: RoleCode[]
  children: React.ReactNode
}

export default function RequireRole({ allowedRoles, children }: RequireRoleProps) {
  const location = useLocation()
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main className="vb-auth-page">
        <section className="vb-auth-wrap">
          <div className="vb-auth-card">
            <h1 className="vb-auth-title">Đang tải phiên đăng nhập...</h1>
          </div>
        </section>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user.role_code === 'CONTESTANT' && !isProfileCompleted(user.profile_completed)) {
    return <Navigate to="/complete-profile" replace />
  }

  if (!user.role_code || !allowedRoles.includes(user.role_code as RoleCode)) {
    return <Navigate to={getDashboardPathForRole(user.role_code, user.profile_completed)} replace />
  }

  return children
}
