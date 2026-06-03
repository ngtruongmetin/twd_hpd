import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { getDashboardTitleForRole } from '../../auth/role'
import { useAuth } from '../../context/useAuth'

const quickActions = [
  {
    title: 'Quản lý người dùng',
    description: 'Xem thông tin chính, tạo tài khoản, xóa tài khoản.',
    to: '/dashboard/tw_admin/users',
  },
  {
    title: 'Quản lý bài nộp',
    description: 'Thống kê theo bảng thi, tỉnh; xem và xóa bài nộp.',
    to: '/dashboard/tw_admin/submissions',
  },
  {
    title: 'Quản lý cuộc thi',
    description: 'Chỉnh thông tin cuộc thi và thông tin hai bảng thi.',
    to: '/dashboard/tw_admin/competitions',
  },
]

export default function TwAdminDashboard() {
  const { user } = useAuth()
  const title = getDashboardTitleForRole(user?.role_code)
  const displayName = user?.full_name || user?.username || 'TW_ADMIN'

  return (
    <main className="vb-page vb-dashboard-page vb-dashboard-tw">
      <Navbar />
      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Điều hành trung ương</p>
          <h1>{title}</h1>
          <p className="vb-admin-lead">
            Trang điều hành dành cho TW_ADMIN, tập trung quản lý tài khoản, bài nộp và cấu hình cuộc thi.
          </p>
        </div>
        <aside className="vb-admin-session">
          <p className="vb-overline">Tài khoản hiện tại</p>
          <h2>{displayName}</h2>
          <dl className="vb-session-list">
            <div>
              <dt>Username</dt>
              <dd>{user?.username || 'unknown'}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user?.role_name || user?.role_code || 'TW_ADMIN'}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="vb-admin-section">
        <div className="vb-section-head">
          <div>
            <p className="vb-overline">Chức năng chính</p>
            <h2>Đi tới khu vực quản lý</h2>
          </div>
        </div>
        <div className="vb-admin-grid vb-admin-grid-tw">
          {quickActions.map((action) => (
            <article key={action.title} className="vb-admin-card vb-admin-card-tw">
              <h3>{action.title}</h3>
              <p>{action.description}</p>
              <Link className="vb-tw-btn-primary" to={action.to}>
                Mở trang
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
