import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/api'
import { getDashboardPathForRole } from '../auth/role'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/useAuth'

type LandingStats = {
  total_submissions: number
  top_province_name: string | null
  top_province_submissions: number
}

function normalizeError(err: unknown, fallback: string) {
  if (typeof err === 'object' && err && 'response' in err) {
    const axiosError = err as { response?: { data?: { message?: string } } }
    return axiosError.response?.data?.message || fallback
  }

  return fallback
}

function useCountUp(target: number, enabled: boolean, duration = 1200) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setValue(0)
      return
    }

    let frame = 0
    let startedAt = 0

    const animate = (timestamp: number) => {
      if (!startedAt) startedAt = timestamp

      const progress = Math.min((timestamp - startedAt) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      setValue(Math.round(target * eased))

      if (progress < 1) {
        frame = window.requestAnimationFrame(animate)
      }
    }

    setValue(0)
    frame = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [target, enabled, duration])

  return value
}

function formatCount(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value)
}

export default function Landing() {
  const { user, loading } = useAuth()
  const [stats, setStats] = useState<LandingStats>({
    total_submissions: 0,
    top_province_name: null,
    top_province_submissions: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState('')

  const isLoggedIn = !loading && !!user
  const actionLabel = isLoggedIn ? 'Truy cập vào Dashboard' : 'Đăng nhập hệ thống'
  const actionPath = isLoggedIn ? getDashboardPathForRole(user?.role_code, user?.profile_completed) : '/login'

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      setStatsLoading(true)
      setStatsError('')

      try {
        const response = await api.get('/api/v1/landing/stats')
        const data = (response.data?.data ?? {}) as Partial<LandingStats>

        if (cancelled) return

        setStats({
          total_submissions: Number(data.total_submissions ?? 0),
          top_province_name: data.top_province_name ?? null,
          top_province_submissions: Number(data.top_province_submissions ?? 0),
        })
      } catch (err: unknown) {
        if (!cancelled) {
          setStatsError(normalizeError(err, 'Không tải được thống kê trang chủ.'))
        }
      } finally {
        if (!cancelled) {
          setStatsLoading(false)
        }
      }
    }

    void loadStats()

    return () => {
      cancelled = true
    }
  }, [])

  const animatedTotal = useCountUp(stats.total_submissions, !statsLoading)
  const animatedProvinceCount = useCountUp(stats.top_province_submissions, !statsLoading)
  const provinceName = stats.top_province_name || 'Chưa có dữ liệu'
  const hasStats = !statsLoading && !statsError

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

      <section className="vb-landing-stats" aria-label="Thống kê bài nộp">
        <article className="vb-card vb-card-featured vb-landing-stat-card is-total">
          <p className="vb-overline">Bài nộp cả nước</p>
          <strong className={`vb-landing-stat-value ${statsLoading ? 'is-loading' : ''}`} aria-live="polite">
            {statsLoading ? '...' : formatCount(animatedTotal)}
          </strong>
          <p className="vb-landing-stat-meta">
            {hasStats
              ? 'Số lượng bài nộp toàn quốc.'
              : 'Số liệu sẽ hiện khi hệ thống tải xong thống kê.'}
          </p>
        </article>

        <article className="vb-card vb-card-featured vb-landing-stat-card is-province">
          <p className="vb-overline">Tỉnh/thành dẫn đầu</p>
          <strong className="vb-landing-stat-name" aria-live="polite">
            {statsLoading ? 'Đang tải...' : provinceName}
          </strong>
          <p className="vb-landing-stat-meta">
            {statsLoading
              ? 'Đang lấy dữ liệu thống kê...'
              : `Ghi nhận ${formatCount(animatedProvinceCount)} bài nộp.`}
          </p>
        </article>
      </section>

      {statsError ? <section className="vb-landing-stats-note">{statsError}</section> : null}

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
