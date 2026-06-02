import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { useAuth } from '../../context/useAuth'
import { api } from '../../api/api'

type SubmissionRow = {
  competition_table_id: number | null
  author_province_name: string | null
}

type CompetitionTableRow = {
  id: number
  name: string
}

function normalizeError(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) return err.response?.data?.message || fallback
  return fallback
}

export default function ProvinceAdminDashboard() {
  const { user } = useAuth()
  const displayName = user?.full_name || user?.username || 'PROVINCE_ADMIN'
  const provinceName = user?.province_name || ''
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [tables, setTables] = useState<CompetitionTableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadData() {
      setLoading(true)
      setError('')
      try {
        const [submissionRes, tableRes] = await Promise.all([
          api.get('/api/v1/submissions'),
          api.get('/api/v1/competition_tables'),
        ])
        if (!active) return
        setSubmissions((submissionRes.data?.data ?? []) as SubmissionRow[])
        setTables((tableRes.data?.data ?? []) as CompetitionTableRow[])
      } catch (err: unknown) {
        if (!active) return
        setError(normalizeError(err, 'Không tải được dữ liệu tổng quan.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadData()

    return () => {
      active = false
    }
  }, [])

  const provinceSubmissions = useMemo(
    () => submissions.filter((row) => row.author_province_name === provinceName),
    [provinceName, submissions],
  )

  const kpiStats = useMemo(() => {
    const tableNameById = new Map<number, string>()
    tables.forEach((table) => tableNameById.set(table.id, table.name.toLowerCase()))

    const capcut = provinceSubmissions.filter((row) => {
      const tableName = tableNameById.get(row.competition_table_id || 0) || ''
      return tableName.includes('capcut')
    }).length

    const keChuyen = provinceSubmissions.filter((row) => {
      const tableName = tableNameById.get(row.competition_table_id || 0) || ''
      return tableName.includes('kể chuyện') || tableName.includes('ke chuyen')
    }).length

    return {
      total: provinceSubmissions.length,
      capcut,
      keChuyen,
    }
  }, [provinceSubmissions, tables])

  return (
    <main className="vb-page vb-dashboard-page vb-dashboard-tw">
      <Navbar />
      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Điều hành tỉnh thành</p>
          <h1>Dashboard QTV tỉnh</h1>
          <p className="vb-admin-lead">
            Trang điều hành dành cho Quản trị tỉnh, tập trung theo dõi bài dự thi thuộc địa phương của mình, xem kết quả chấm điểm và tình hình tham gia cuộc thi.
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
              <dt>Tỉnh/Thành</dt>
              <dd>{user?.province_name || 'N/A'}</dd>
            </div>
          </dl>
        </aside>
      </section>

      {error ? <section className="vb-account-banner is-error">{error}</section> : null}
      {loading ? <section className="vb-account-banner">Đang tải dữ liệu tổng quan...</section> : null}

      <section className="vb-admin-section">
        <div className="vb-section-head">
          <div>
            <p className="vb-overline">Tổng quan</p>
            <h2>Thống kê bài dự thi của tỉnh</h2>
          </div>
        </div>
        <div className="vb-tw-stats-grid vb-province-kpi-grid">
          <article className="vb-season-panel vb-province-kpi-card">
            <p className="vb-overline">Tổng bài</p>
            <strong className="vb-province-kpi-value">{kpiStats.total}</strong>
            <span className="vb-province-kpi-label">Tổng số bài dự thi của tỉnh</span>
          </article>
          <article className="vb-season-panel vb-province-kpi-card">
            <p className="vb-overline">CapCut</p>
            <strong className="vb-province-kpi-value">{kpiStats.capcut}</strong>
            <span className="vb-province-kpi-label">Số bài dự thi bảng sáng tạo CapCut "Nhật ký Hạ Đỏ"</span>
          </article>
          <article className="vb-season-panel vb-province-kpi-card">
            <p className="vb-overline">Kể chuyện</p>
            <strong className="vb-province-kpi-value">{kpiStats.keChuyen}</strong>
            <span className="vb-province-kpi-label">Số bài dự thi bảng Kể chuyện "Hạ Đỏ trưởng thành"</span>
          </article>
        </div>
      </section>

      <section className="vb-admin-section">
        <div className="vb-section-head">
          <div>
            <p className="vb-overline">Chức năng chính</p>
            <h2>Quản lý bài nộp của tỉnh</h2>
          </div>
        </div>

        <div className="vb-province-action">
          <article className="vb-admin-card vb-admin-card-tw vb-province-card">
            <h3>Theo dõi bài nộp</h3>
            <p>Xem danh sách bài dự thi, điểm bình chọn và kết quả chấm điểm thuộc tỉnh của bạn.</p>
            <Link
              className="vb-tw-btn-primary vb-province-btn"
              to="/dashboard/province_admin/submissions"
            >
              Mở trang
            </Link>
          </article>
        </div>
      </section>
    </main>
  )
}
