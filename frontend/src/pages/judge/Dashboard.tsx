import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { getDashboardTitleForRole } from '../../auth/role'
import { useAuth } from '../../context/useAuth'

export default function JudgeDashboard() {
  const { user } = useAuth()
  const title = getDashboardTitleForRole(user?.role_code)
  const displayName = user?.full_name || user?.username || 'JUDGE'

  return (
    <main className="vb-page vb-dashboard-page vb-dashboard-tw">
      <Navbar />
      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Giám khảo</p>
          <h1>{title}</h1>
          <p className="vb-admin-lead">
            Xem danh sách bài dự thi và thực hiện chấm điểm theo các tiêu chí của từng bảng thi.
          </p>
        </div>
        <aside className="vb-admin-session">
          <p className="vb-overline">Tài khoản hiện tại</p>
          <h2>{displayName}</h2>
          <dl className="vb-session-list">
            <div>
              <dt>Họ tên</dt>
              <dd>{user?.full_name || 'N/A'}</dd>
            </div>
            <div>
              <dt>Username</dt>
              <dd>{user?.username || 'unknown'}</dd>
            </div>
            <div>
              <dt>Vai trò</dt>
              <dd>Giám khảo</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="vb-admin-section">
        <div className="vb-section-head">
          <div>
            <h2>Đi tới khu vực chấm điểm</h2>
          </div>
        </div>
        <div className="vb-province-action">
          <article className="vb-admin-card vb-admin-card-tw vb-province-card">
            <h3>Danh sách bài dự thi</h3>
            <p>Xem danh sách bài dự thi và thực hiện chấm điểm theo các tiêu chí của từng bảng thi.</p>
            <Link
              className="vb-tw-btn-primary vb-province-btn"
              to="/dashboard/judge/submissions"
            >
              Mở trang
            </Link>
          </article>
        </div>
      </section>
    </main>
  )
}
