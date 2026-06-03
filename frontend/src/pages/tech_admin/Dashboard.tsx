import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { getDashboardTitleForRole } from '../../auth/role'
import { useAuth } from '../../context/useAuth'

const quickActions = [
  {
    title: 'Quản lý tài khoản',
    description: 'Tạo, sửa, xóa tài khoản, kiểm soát role và trạng thái ngay trên web.',
    meta: 'CRUD users',
    to: '/dashboard/tech_admin/accounts',
  },
  {
    title: 'Cuộc thi và cấu hình',
    description: 'Quản lý mùa thi, timeline và bảng thi mà không cần đụng SSH.',
    meta: 'CRUD seasons, competition_tables',
    to: '/dashboard/tech_admin/seasons',
  },
  {
    title: 'Vận hành web',
    description: 'Gửi mail, export dữ liệu và xem nhật ký email ngay trên web.',
    meta: 'mail/sendto, export/users, email_logs',
    to: '/dashboard/tech_admin/operations',
  },
  {
    title: 'Bài thi và kết quả',
    description: 'Quản trị submission, chấm điểm và bảng tổng kết.',
    meta: 'submissions, submission_results',
  },
  {
    title: 'An ninh hệ thống',
    description: 'Giám sát session, audit và các tín hiệu bảo mật.',
    meta: 'session, security',
  },
]


export default function TechAdminDashboard() {
  const { user } = useAuth()
  const title = getDashboardTitleForRole(user?.role_code)
  const displayName = user?.full_name || user?.username || 'TECH_ADMIN'

  return (
    <main className="vb-page vb-dashboard-page vb-dashboard-tech">
      <Navbar />

      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Quản trị kỹ thuật</p>
          <h1>{title}</h1>
          <p className="vb-admin-lead">
            Trung tâm điều hành cho tài khoản quản trị viên kỹ thuật. Mọi chỉnh sửa vận hành cốt lõi đều được thực hiện trực tiếp trên web.
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
              <dd>{user?.role_name || user?.role_code || 'TECH_ADMIN'}</dd>
            </div>

          </dl>
        </aside>
      </section>



      <section className="vb-admin-section">
        <div className="vb-section-head">
          <div>
            <p className="vb-overline">Lối tắt vận hành</p>
            <h2>Các khu vực CRUD chính</h2>
          </div>
        </div>

        <div className="vb-admin-grid">
          {quickActions.map((action) => (
            <article key={action.title} className="vb-admin-card">
              <p className="vb-admin-card-meta">{action.meta}</p>
              <h3>{action.title}</h3>
              <p>{action.description}</p>
              {'to' in action && action.to ? (
                <Link className="vb-admin-card-link" to={action.to}>
                  Mở trang
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      </section>


    </main>
  )
}
