import { Link } from 'react-router-dom'
import { getDashboardPathForRole } from '../auth/role'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/useAuth'

export default function Landing() {
  const { user, loading } = useAuth()
  const isLoggedIn = !loading && !!user
  const actionLabel = isLoggedIn ? 'Truy cập vào Dashboard' : 'Đăng nhập hệ thống'
  const actionPath = isLoggedIn ? getDashboardPathForRole(user?.role_code) : '/login'

  return (
    <main className="vb-page">
      <Navbar />

      <section className="vb-hero">
        <p className="vb-overline">Cuộc thi</p>
        <h1>Nhật ký Hoa phượng đỏ năm 2026</h1>
        <p className="vb-lead">
          Nền tảng nộp bài dự thi trực tuyến dành cho chiến sĩ Hoa phượng đỏ toàn quốc.
        </p>
        <div className="vb-actions">
          <Link className="vb-btn vb-btn-primary" to={actionPath}>
            {loading ? 'Đang kiểm tra phiên...' : actionLabel}
          </Link>
        </div>
      </section>

      <section id="categories" className="vb-grid">
        <article className="vb-card vb-card-featured">
          <p className="vb-overline">Bảng thi 1</p>
          <h2>Sáng tạo CapCut “Nhật ký hạ đỏ”</h2>
          <p>Video tối đa 01 phút, định dạng MP4/MOV, chất lượng từ 720p.</p>
        </article>
        <article className="vb-card vb-card-featured">
          <p className="vb-overline">Bảng thi 2</p>
          <h2>Kể chuyện “Hạ đỏ trưởng thành”</h2>
          <p>Video tối đa 05 phút, khung hình 16:9, chất lượng từ 720p.</p>
        </article>
      </section>

      <footer className="vb-footer">
        Hệ thống nộp bài và chấm thi trực tuyến cuộc thi “Nhật ký Hoa phượng đỏ" năm 2026
      </footer>
    </main>
  )
}
