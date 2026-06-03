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
  fb_url: string | null
  author_full_name: string | null
}

type CompetitionTableRow = {
  id: number
  name: string
}

const PAGE_SIZE = 10

function normalizeError(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) return err.response?.data?.message || fallback
  return fallback
}

export default function ProvinceAdminSubmissions() {
  const { user } = useAuth()
  const provinceName = user?.province_name || 'tỉnh của bạn'
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [tables, setTables] = useState<CompetitionTableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [tableFilter, setTableFilter] = useState('ALL')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [submissionRes, tableRes] = await Promise.all([
        api.get('/api/v1/province/submissions'),
        api.get('/api/v1/competition_tables'),
      ])

      setSubmissions((submissionRes.data?.data ?? []) as SubmissionRow[])
      setTables((tableRes.data?.data ?? []) as CompetitionTableRow[])
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không tải được dữ liệu bài nộp.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const tableNameById = useMemo(() => {
    const map = new Map<number, string>()
    tables.forEach((table) => map.set(table.id, table.name))
    return map
  }, [tables])

  const filteredRows = useMemo(() => {
    return submissions.filter((row) => {
      return tableFilter === 'ALL' || String(row.competition_table_id || '') === tableFilter
    })
  }, [submissions, tableFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedRows = useMemo(
    () => filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredRows, safePage],
  )

  useEffect(() => {
    setPage(1)
  }, [tableFilter])

  return (
    <main className="vb-page vb-dashboard-page vb-tw-submissions-page">
      <Navbar />
      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Điều hành tỉnh thành</p>
          <h1>Quản lý bài nộp</h1>
          <p className="vb-admin-lead">
            Theo dõi các bài thi thuộc {provinceName}, xem nhanh bảng thi, tên người nộp và các liên kết liên quan.
          </p>
        </div>
      </section>

      {error ? <section className="vb-account-banner is-error">{error}</section> : null}
      {loading ? <section className="vb-account-banner">Đang tải dữ liệu...</section> : null}

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
                {tables.map((table) => (
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
                <th>Tên người nộp</th>
                <th>Tiêu đề</th>
                <th>Link bài thi</th>
                <th>Link bài fb</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
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
                  <td>
                    {row.fb_url ? (
                      <a
                        className="vb-tw-btn-link"
                        href={row.fb_url}
                        target="_blank"
                        rel="noreferrer"
                        title="Mở bài đăng Facebook trong tab mới"
                        aria-label="Mở bài đăng Facebook trong tab mới"
                      >
                        Xem bài đăng
                      </a>
                    ) : (
                      <span className="vb-status-pill is-inactive">Chưa được đăng</span>
                    )}
                  </td>
                </tr>
              ))}
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
