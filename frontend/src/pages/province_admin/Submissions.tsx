import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import Navbar from '../../components/Navbar'
import { api } from '../../api/api'
import { useAuth } from '../../context/useAuth'

type SubmissionRow = {
  id: number
  title: string
  competition_table_id: number | null
  video_url: string | null
  author_full_name: string | null
  author_province_name: string | null
}

type CompetitionTableRow = {
  id: number
  name: string
}

type ResultRow = {
  submission_id: number
  vote_converted_points: number | string
  judge_total_points: number | string
  final_points: number | string
}

const PAGE_SIZE = 10

function toNumber(value: number | string | null | undefined) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeError(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) return err.response?.data?.message || fallback
  return fallback
}

export default function ProvinceAdminSubmissions() {
  const { user } = useAuth()
  const provinceName = user?.province_name || ''
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [tables, setTables] = useState<CompetitionTableRow[]>([])
  const [results, setResults] = useState<ResultRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [page, setPage] = useState(1)
  const [tableFilter, setTableFilter] = useState('ALL')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [submissionRes, tableRes, resultRes] = await Promise.all([
        api.get('/api/v1/submissions'),
        api.get('/api/v1/competition_tables'),
        api.get('/api/v1/submission_results'),
      ])
      setSubmissions((submissionRes.data?.data ?? []) as SubmissionRow[])
      setTables((tableRes.data?.data ?? []) as CompetitionTableRow[])
      setResults((resultRes.data?.data ?? []) as ResultRow[])
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không tải được dữ liệu bài nộp.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const resultBySubmissionId = useMemo(() => {
    const map = new Map<number, ResultRow>()
    results.forEach((result) => map.set(result.submission_id, result))
    return map
  }, [results])

  const tableNameById = useMemo(() => {
    const map = new Map<number, string>()
    tables.forEach((table) => map.set(table.id, table.name))
    return map
  }, [tables])

  const filteredRows = useMemo(() => {
    return submissions.filter((row) => {
      const provinceOk = row.author_province_name === provinceName
      const tableOk = tableFilter === 'ALL' || String(row.competition_table_id || '') === tableFilter
      return provinceOk && tableOk
    })
  }, [submissions, provinceName, tableFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [tableFilter, provinceName])

  const tableStats = useMemo(() => {
    const countMap = new Map<number, number>()
    submissions.forEach((row) => {
      if (row.author_province_name !== provinceName) return
      const key = row.competition_table_id || 0
      countMap.set(key, (countMap.get(key) || 0) + 1)
    })
    return tables
      .map((table) => ({ id: table.id, name: table.name, total: countMap.get(table.id) || 0 }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'vi'))
  }, [provinceName, submissions, tables])

  const kpiStats = useMemo(() => {
    const normalizedTables = tableStats.map((table) => ({
      ...table,
      nameLower: table.name.toLowerCase(),
    }))

    const capcutTotal =
      normalizedTables.find((table) => table.nameLower.includes('capcut'))?.total ?? 0
    const keChuyenTotal =
      normalizedTables.find((table) => table.nameLower.includes('kể chuyện') || table.nameLower.includes('ke chuyen'))?.total ?? 0

    return {
      total: filteredRows.length,
      capcut: capcutTotal,
      keChuyen: keChuyenTotal,
    }
  }, [filteredRows.length, tableStats])

  return (
    <main className="vb-page vb-dashboard-page vb-tw-submissions-page">
      <Navbar />
      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Điều hành tỉnh thành</p>
          <h1>Quản lý bài nộp</h1>
          <p className="vb-admin-lead">
            Theo dõi toàn bộ bài dự thi thuộc tỉnh của bạn, xem điểm chấm, điểm bình chọn và kết quả tổng hợp.
          </p>
        </div>
      </section>

      {error ? <section className="vb-account-banner is-error">{error}</section> : null}
      {message ? <section className="vb-account-banner">{message}</section> : null}
      {loading ? <section className="vb-account-banner">Đang tải dữ liệu...</section> : null}

      <section className="vb-tw-stats-grid vb-province-kpi-grid">
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
      </section>

      <section className="vb-season-panel">
        <div className="vb-section-head is-compact">
          <div>
            <p className="vb-overline">Danh sách</p>
            <h2>Thông tin bài nộp</h2>
          </div>
          <p className="vb-section-note">{filteredRows.length} bài nộp khớp điều kiện hiện tại.</p>
        </div>

        <div className="vb-account-toolbar">
          <div className="vb-account-filters">
            <div>
              <label htmlFor="province-table-filter">Bảng thi</label>
              <select
                id="province-table-filter"
                className="vb-select"
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
              >
                <option value="ALL">Tất cả bảng thi</option>
                {tableStats.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="vb-account-table-wrap">
          <table className="vb-account-table">
            <thead>
              <tr>
                <th>Bảng thi</th>
                <th>Người nộp</th>
                <th>Tiêu đề</th>
                <th>Bài thi</th>
                <th>Điểm bình chọn</th>
                <th>Điểm bài thi</th>
                <th>Tổng điểm</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => {
                const result = resultBySubmissionId.get(row.id)
                return (
                  <tr key={row.id}>
                    <td>{tableNameById.get(row.competition_table_id || 0) || 'N/A'}</td>
                    <td>{row.author_full_name || 'N/A'}</td>
                    <td>{row.title || 'N/A'}</td>
                    <td>
                      {row.video_url ? (
                        <a className="vb-tw-btn-link" href={row.video_url} target="_blank" rel="noreferrer">
                          Xem bài thi
                        </a>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td>{toNumber(result?.vote_converted_points).toFixed(2)}</td>
                    <td>{toNumber(result?.judge_total_points).toFixed(2)}</td>
                    <td>
                      <strong>{toNumber(result?.final_points).toFixed(2)}</strong>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="vb-tw-pagination">
          <button
            type="button"
            className="vb-tw-btn-muted"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Trang trước
          </button>
          <span>Trang {safePage}/{totalPages}</span>
          <button
            type="button"
            className="vb-tw-btn-muted"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Trang sau
          </button>
        </div>
      </section>
    </main>
  )
}
