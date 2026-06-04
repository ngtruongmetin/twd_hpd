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
  author_ward_name: string | null
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
  const [query, setQuery] = useState('')
  const [tableFilter, setTableFilter] = useState('ALL')
  const [wardFilter, setWardFilter] = useState('ALL')

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

  const tableOptions = useMemo(
    () => [...tables].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [tables],
  )

  const wardOptions = useMemo(() => {
    const map = new Map<string, number>()
    submissions.forEach((row) => {
      const label = row.author_ward_name?.trim()
      if (!label) return
      map.set(label, (map.get(label) || 0) + 1)
    })

    return Array.from(map.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'vi'))
  }, [submissions])

  const filteredRows = useMemo(() => {
    const filteredByFilters = submissions.filter((row) => {
      const tableOk = tableFilter === 'ALL' || String(row.competition_table_id || '') === tableFilter
      const wardOk = wardFilter === 'ALL' || row.author_ward_name === wardFilter
      return tableOk && wardOk
    })

    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return filteredByFilters

    return filteredByFilters.filter((row) => {
      const tableName = tableNameById.get(row.competition_table_id || 0) || ''
      return [tableName, row.author_full_name, row.title]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    })
  }, [submissions, tableFilter, wardFilter, query, tableNameById])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedRows = useMemo(
    () => filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredRows, safePage],
  )

  useEffect(() => {
    setPage(1)
  }, [tableFilter, wardFilter, query])

  const kpiStats = useMemo(() => {
    const wardSet = new Set<string>()
    filteredRows.forEach((row) => {
      const wardName = row.author_ward_name?.trim()
      if (wardName) wardSet.add(wardName)
    })

    return {
      totalSubmissions: filteredRows.length,
      uniqueWards: wardSet.size,
    }
  }, [filteredRows])

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

      <section className="vb-tw-stats-grid vb-tw-stats-grid-2">
        <article className="vb-season-panel vb-province-kpi-card">
          <p className="vb-overline">Bài nộp</p>
          <strong className="vb-province-kpi-value">{kpiStats.totalSubmissions}</strong>
          <span className="vb-province-kpi-label">
            Số bài dự thi theo bộ lọc hiện tại.
          </span>
        </article>
        <article className="vb-season-panel vb-province-kpi-card">
          <p className="vb-overline">Phường tham gia</p>
          <strong className="vb-province-kpi-value">{kpiStats.uniqueWards}</strong>
          <span className="vb-province-kpi-label">
            Số phường tham gia theo bộ lọc hiện tại.
          </span>
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

        <div className="vb-tw-toolbar-row">
          <div className="vb-account-search">
            <label htmlFor="province-submission-search">Tìm kiếm</label>
            <input
              id="province-submission-search"
              className="vb-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tên bảng thi, người nộp, tiêu đề..."
            />
          </div>

          <div className="vb-account-filters" style={{ gridColumn: 'auto' }}>
            <div>
              <label htmlFor="province-table-filter">Bảng thi</label>
              <select
                id="province-table-filter"
                className="vb-select"
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
              >
                <option value="ALL">Tất cả bảng thi</option>
                {tableOptions.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="province-ward-filter">Phường</label>
              <select
                id="province-ward-filter"
                className="vb-select"
                value={wardFilter}
                onChange={(e) => setWardFilter(e.target.value)}
              >
                <option value="ALL">Tất cả phường</option>
                {wardOptions.map((ward) => (
                  <option key={ward.label} value={ward.label}>
                    {ward.label}
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
                <th>Link bài đăng</th>
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
