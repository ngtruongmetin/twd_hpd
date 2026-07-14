import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/api'
import Navbar from '../../components/Navbar'
import { getDashboardTitleForRole } from '../../auth/role'
import { useAuth } from '../../context/useAuth'

type ProvinceApiItem = {
  code: number
  name: string
}

type ProvinceStatRow = {
  province_key: string
  province_name: string
  school_count: number
  participating_school_count: number
  total_submissions: number
  failed_submissions: number
  passed_submissions: number
  pass_rate: number
  participation_rate: number
  top_ward_name: string | null
  top_school_name: string | null
}

type ProvinceDisplayRow = {
  stt: number
  province_name: string
  school_count: number
  participating_school_count: number
  total_submissions: number
  failed_submissions: number
  passed_submissions: number
  pass_rate: number
  participation_rate: number
  top_ward_name: string | null
  top_school_name: string | null
}

const SCHOOL_COUNTS: Record<number, number> = {
  1: 237,
  4: 40,
  8: 93,
  11: 37,
  12: 31,
  14: 57,
  15: 84,
  19: 62,
  20: 48,
  22: 54,
  24: 12,
  25: 161,
  31: 134,
  33: 85,
  37: 130,
  38: 81,
  40: 12,
  42: 49,
  44: 78,
  46: 39,
  48: 87,
  51: 80,
  52: 86,
  56: 67,
  66: 118,
  68: 115,
  75: 118,
  79: 267,
  80: 83,
  82: 92,
  86: 133,
  91: 121,
  92: 105,
  96: 63,
}

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

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0111\u0110]/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeProvinceKey(value: string) {
  let text = normalizeText(value)
  text = text.replace(/^(tp|thanh pho)\s+/g, '')
  text = text.replace(/\s+city$/g, '')
  return text
}

function normalizeError(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) return err.response?.data?.message || fallback
  return fallback
}

function formatRate(value: number) {
  return `${value.toFixed(1)}%`
}

export default function TwAdminDashboard() {
  const { user } = useAuth()
  const title = getDashboardTitleForRole(user?.role_code)
  const displayName = user?.full_name || user?.username || 'TW_ADMIN'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [provinceOptions, setProvinceOptions] = useState<ProvinceApiItem[]>([])
  const [provinceStats, setProvinceStats] = useState<ProvinceStatRow[]>([])
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let active = true

    async function loadDashboardStats() {
      setLoading(true)
      setError('')

      try {
        const [provinceResponse, statsResponse] = await Promise.all([
          fetch('https://provinces.open-api.vn/api/v2/p/'),
          api.get('/api/v1/tw_admin/province-stats'),
        ])

        if (!active) return

        if (!provinceResponse.ok) {
          throw new Error('Không tải được danh sách tỉnh/thành.')
        }

        const provinceData = (await provinceResponse.json()) as ProvinceApiItem[]
        setProvinceOptions(provinceData)
        setProvinceStats((statsResponse.data?.data ?? []) as ProvinceStatRow[])
      } catch (err: unknown) {
        if (!active) return
        setError(normalizeError(err, 'Không tải được thống kê tỉnh/thành.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDashboardStats()

    return () => {
      active = false
    }
  }, [])

  const displayedRows = useMemo(() => {
    const statsByProvince = new Map(provinceStats.map((row) => [normalizeProvinceKey(row.province_key || row.province_name), row]))

    return provinceOptions.map((province, index) => {
      const stat = statsByProvince.get(normalizeProvinceKey(province.name))

      return {
        stt: index + 1,
        province_name: province.name,
        school_count: SCHOOL_COUNTS[province.code] ?? 0,
        participating_school_count: stat?.participating_school_count ?? 0,
        total_submissions: stat?.total_submissions ?? 0,
        failed_submissions: stat?.failed_submissions ?? 0,
        passed_submissions: stat?.passed_submissions ?? 0,
        pass_rate: stat?.pass_rate ?? 0,
        participation_rate:
          (SCHOOL_COUNTS[province.code] ?? 0) > 0
            ? (((stat?.participating_school_count ?? 0) / (SCHOOL_COUNTS[province.code] ?? 0)) * 100)
            : 0,
        top_ward_name: stat?.top_ward_name ?? null,
        top_school_name: stat?.top_school_name ?? null,
      } satisfies ProvinceDisplayRow
    })
  }, [provinceOptions, provinceStats])

  const totalsRow = useMemo(() => {
    return displayedRows.reduce(
      (acc, row) => {
        acc.school_count += row.school_count
        acc.participating_school_count += row.participating_school_count
        acc.total_submissions += row.total_submissions
        acc.failed_submissions += row.failed_submissions
        acc.passed_submissions += row.passed_submissions
        return acc
      },
      {
        school_count: 0,
        participating_school_count: 0,
        total_submissions: 0,
        failed_submissions: 0,
        passed_submissions: 0,
      },
    )
  }, [displayedRows])

  const participationRateTotal = useMemo(() => {
    return totalsRow.school_count > 0
      ? (totalsRow.participating_school_count / totalsRow.school_count) * 100
      : 0
  }, [totalsRow.participating_school_count, totalsRow.school_count])

  async function handleExportProvinceStats() {
    try {
      setExporting(true)
      const response = await api.post(
        '/api/v1/export/province-stats',
        {},
        { responseType: 'blob' },
      )

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'province_stats.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không xuất được file Excel thống kê tỉnh/thành.'))
    } finally {
      setExporting(false)
    }
  }

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

      {error ? <section className="vb-account-banner is-error">{error}</section> : null}
      {loading ? <section className="vb-account-banner">Đang tải thống kê 34 tỉnh/thành...</section> : null}

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

      <section className="vb-season-panel" style={{ marginTop: 24 }}>
        <div className="vb-section-head is-compact">
          <div>
            <p className="vb-overline">Thống kê địa phương</p>
            <h2>Số liệu thống kê 34 tỉnh/thành</h2>
          </div>
          <button type="button" className="vb-tw-btn-primary" onClick={() => void handleExportProvinceStats()} disabled={exporting}>
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        </div>

        <div className="vb-account-table-wrap">
          <table className="vb-account-table">
            <thead>
              <tr>
                <th style={{ width: 72 }}>STT</th>
                <th>Đơn vị</th>
                <th>Tổng bài dự thi</th>
                <th>Số bài không đạt</th>
                <th>Số bài đạt</th>
                <th>Tỷ lệ đạt điều kiện</th>
                <th>Tổng số đoàn trường</th>
                <th>Số đoàn trường tham gia</th>
                <th>Tỷ lệ tham gia</th>
                <th>Xã/phường nhiều bài dự thi nhất</th>
                <th>Trường nhiều bài dự thi nhất</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row) => (
                <tr key={row.stt}>
                  <td style={{ fontWeight: 700 }}>{row.stt}</td>
                  <td>{row.province_name}</td>
                  <td>{row.total_submissions}</td>
                  <td>{row.failed_submissions}</td>
                  <td>{row.passed_submissions}</td>
                  <td>{formatRate(row.pass_rate)}</td>
                  <td>{row.school_count}</td>
                  <td>{row.participating_school_count}</td>
                  <td>{formatRate(row.participation_rate)}</td>
                  <td>{row.top_ward_name || 'Chưa có'}</td>
                  <td>{row.top_school_name || 'Chưa có'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="vb-account-table-total">
                <th colSpan={2}>Tổng cộng</th>
                <th>{totalsRow.total_submissions}</th>
                <th>{totalsRow.failed_submissions}</th>
                <th>{totalsRow.passed_submissions}</th>
                <th>
                  {totalsRow.total_submissions > 0 ? formatRate((totalsRow.passed_submissions / totalsRow.total_submissions) * 100) : '0.0%'}
                </th>
                <th>{totalsRow.school_count}</th>
                <th>{totalsRow.participating_school_count}</th>
                <th>{formatRate(participationRateTotal)}</th>
                <th colSpan={2}>-</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </main>
  )
}
