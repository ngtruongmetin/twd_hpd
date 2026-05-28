import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

type RequireAuthProps = {
  children: React.ReactNode
}

export default function RequireAuth({ children }: RequireAuthProps) {
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

  return children
}
