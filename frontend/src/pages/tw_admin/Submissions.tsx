import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import Navbar from '../../components/Navbar'
import { api } from '../../api/api'

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

export default function TwAdminSubmissions() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [tables, setTables] = useState<CompetitionTableRow[]>([])
  const [results, setResults] = useState<ResultRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [page, setPage] = useState(1)
  const [tableFilter, setTableFilter] = useState('ALL')
  const [provinceFilter, setProvinceFilter] = useState('ALL')
  const [deletingId, setDeletingId] = useState<number | null>(null)

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

  const filteredRows = useMemo(
    () =>
      submissions.filter((row) => {
        const tableOk = tableFilter === 'ALL' || String(row.competition_table_id || '') === tableFilter
        const provinceOk = provinceFilter === 'ALL' || row.author_province_name === provinceFilter
        return tableOk && provinceOk
      }),
    [submissions, tableFilter, provinceFilter],
  )

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [tableFilter, provinceFilter])

  const tableStats = useMemo(() => {
    const countMap = new Map<number, number>()
    submissions.forEach((row) => {
      const key = row.competition_table_id || 0
      countMap.set(key, (countMap.get(key) || 0) + 1)
    })
    return tables
      .map((table) => ({ id: table.id, name: table.name, total: countMap.get(table.id) || 0 }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'vi'))
  }, [submissions, tables])

  const provinceStats = useMemo(() => {
    const map = new Map<string, number>()
    submissions.forEach((row) => {
      const key = row.author_province_name || 'Chưa rõ tỉnh/thành'
      map.set(key, (map.get(key) || 0) + 1)
    })
    return Array.from(map.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'vi'))
  }, [submissions])

  async function handleDeleteSubmission(id: number) {
    if (!window.confirm(`Xóa bài nộp #${id}?`)) return
    setDeletingId(id)
    setError('')
    setMessage('')
    try {
      await api.delete(`/api/v1/submissions/${id}`)
      setMessage('Đã xóa bài nộp.')
      await loadData()
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không xóa được bài nộp.'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="vb-page vb-dashboard-page vb-tw-submissions-page">
      <Navbar />
      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">TW_ADMIN</p>
          <h1>Quản lý bài nộp</h1>
          <p className="vb-admin-lead">Lọc theo bảng thi và tỉnh/thành, xem điểm và quản trị danh sách bài nộp.</p>
        </div>
      </section>

      {error ? <section className="vb-account-banner is-error">{error}</section> : null}
      {message ? <section className="vb-account-banner">{message}</section> : null}
      {loading ? <section className="vb-account-banner">Đang tải dữ liệu...</section> : null}

      <section className="vb-tw-stats-grid vb-tw-stats-grid-2">
        <article className="vb-season-panel">
          <p className="vb-overline">Theo bảng thi</p>
          <div className="vb-tw-stat-list">
            {tableStats.map((item) => (
              <div key={item.id} className="vb-tw-stat-item"><span>{item.name}</span><strong>{item.total}</strong></div>
            ))}
          </div>
        </article>
        <article className="vb-season-panel">
          <p className="vb-overline">Theo tỉnh/thành</p>
          <div className="vb-tw-stat-list">
            {provinceStats.map((item) => (
              <div key={item.label} className="vb-tw-stat-item"><span>{item.label}</span><strong>{item.total}</strong></div>
            ))}
          </div>
        </article>
      </section>

      <section className="vb-season-panel">
        <div className="vb-section-head is-compact">
          <div>
            <p className="vb-overline">Danh sách bài nộp</p>
            <h2>Kết quả lọc</h2>
          </div>
          <p className="vb-section-note">{filteredRows.length} bài nộp khớp điều kiện hiện tại.</p>
        </div>

        <div className="vb-account-toolbar">
          <div className="vb-account-filters">
            <div>
              <label htmlFor="tw-table-filter">Bảng thi</label>
              <select id="tw-table-filter" className="vb-select" value={tableFilter} onChange={(e) => setTableFilter(e.target.value)}>
                <option value="ALL">Tất cả bảng thi</option>
                {tableStats.map((table) => (
                  <option key={table.id} value={table.id}>{table.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tw-province-filter">Tỉnh/Thành</label>
              <select id="tw-province-filter" className="vb-select" value={provinceFilter} onChange={(e) => setProvinceFilter(e.target.value)}>
                <option value="ALL">Tất cả tỉnh/thành</option>
                {provinceStats.filter((item) => item.label !== 'Chưa rõ tỉnh/thành').map((item) => (
                  <option key={item.label} value={item.label}>{item.label}</option>
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
                <th>Xóa</th>
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
                    <td>{row.video_url ? <a className="vb-tw-btn-link" href={row.video_url} target="_blank" rel="noreferrer">Xem bài thi</a> : 'N/A'}</td>
                    <td>{toNumber(result?.vote_converted_points).toFixed(2)}</td>
                    <td>{toNumber(result?.judge_total_points).toFixed(2)}</td>
                    <td><strong>{toNumber(result?.final_points).toFixed(2)}</strong></td>
                    <td><button type="button" className="vb-tw-btn-danger" onClick={() => void handleDeleteSubmission(row.id)}>{deletingId === row.id ? 'Đang xóa...' : 'Xóa'}</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="vb-tw-pagination">
          <button type="button" className="vb-tw-btn-muted" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trang trước</button>
          <span>Trang {safePage}/{totalPages}</span>
          <button type="button" className="vb-tw-btn-muted" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Trang sau</button>
        </div>
      </section>
    </main>
  )
}
