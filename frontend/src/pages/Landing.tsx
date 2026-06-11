import axios from 'axios'
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
  if (axios.isAxiosError(err)) return err.response?.data?.message || fallback
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

function getDayKey(date = new Date()) {
  return date.toLocaleDateString('en-CA')
}

function hashString(input: string) {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function getDailyMultiplier(dayKey: string, statKey: string) {
  const seed = hashString(`${dayKey}:${statKey}`)
  const ratio = seed / 0xffffffff
  return 1.2 + ratio * 0.4
}

function getStorageKey(statKey: string) {
  return `landing_display_${statKey}`
}

function readStoredDisplay(statKey: string) {
  try {
    const raw = window.localStorage.getItem(getStorageKey(statKey))
    if (!raw) return null

    const parsed = JSON.parse(raw) as { dayKey?: string; value?: number }
    if (!parsed.dayKey || typeof parsed.value !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

function saveStoredDisplay(statKey: string, dayKey: string, value: number) {
  try {
    window.localStorage.setItem(getStorageKey(statKey), JSON.stringify({ dayKey, value }))
  } catch {
    // Ignore storage errors and keep the UI functional.
  }
}

function useInflatedCount(rawValue: number, statKey: string, enabled: boolean) {
  const [displayValue, setDisplayValue] = useState(rawValue)

  useEffect(() => {
    if (!enabled) {
      setDisplayValue(rawValue)
      return
    }

    const dayKey = getDayKey()
    const cached = readStoredDisplay(statKey)

    if (cached?.dayKey === dayKey && typeof cached.value === 'number') {
      setDisplayValue(cached.value)
      return
    }

    const multiplier = getDailyMultiplier(dayKey, statKey)
    const computed = Math.round(rawValue * multiplier)
    const previousValue = typeof cached?.value === 'number' ? cached.value : 0
    const nextValue = Math.max(computed, previousValue)

    saveStoredDisplay(statKey, dayKey, nextValue)
    setDisplayValue(nextValue)
  }, [enabled, rawValue, statKey])

  return displayValue
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

  const inflatedTotal = useInflatedCount(stats.total_submissions, 'total_submissions', !statsLoading && !statsError)
  const inflatedProvinceCount = useInflatedCount(
    stats.top_province_submissions,
    'top_province_submissions',
    !statsLoading && !statsError,
  )
  const animatedTotal = useCountUp(inflatedTotal, !statsLoading && !statsError)
  const animatedProvinceCount = useCountUp(inflatedProvinceCount, !statsLoading && !statsError)
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
              : 'Số liệu sẽ hiển thị khi hệ thống tải xong thống kê.'}
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
        Hệ thống nộp bài và chấm thi trực tuyến cuộc thi “Nhật ký Hoa phượng đỏ” năm 2026
      </footer>
    </main>
  )
}
