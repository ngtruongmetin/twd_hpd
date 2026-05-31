import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { getDashboardTitleForRole } from '../../auth/role'
import { useAuth } from '../../context/useAuth'

const quickActions = [
  {
    title: 'Quản lý tài khoản',
    description: 'Tra cứu, lọc và xem chi tiết user, role, trạng thái.',
    meta: 'users, roles',
    to: '/dashboard/tech_admin/accounts',
  },
  {
    title: 'Cuộc thi và cấu hình',
    description: 'Thiết lập timeline, bảng thi và các mốc công bố.',
    meta: 'seasons, competition_tables',
    to: '/dashboard/tech_admin/seasons',
  },
  {
    title: 'Hệ thống email',
    description: 'Theo dõi gửi mail, lỗi gửi và dữ liệu logging.',
    meta: 'mail/sendto, email_logs',
  },
  {
    title: 'Xuất dữ liệu',
    description: 'Kéo báo cáo, snapshot vận hành và file export.',
    meta: 'export',
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
            Trung tâm điều hành cho tài khoản quản trị viên kỹ thuật.
          </p>
          <div className="vb-chip-row">
            <Link className="vb-chip vb-chip-link" to="/dashboard/tech_admin/accounts">
              Quản lý tài khoản
            </Link>
          </div>
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
            <h2>Các khu vực quản trị</h2>
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
