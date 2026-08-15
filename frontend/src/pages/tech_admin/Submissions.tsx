import axios from 'axios'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Navbar from '../../components/Navbar'
import { api } from '../../api/api'
import { useAuth } from '../../context/useAuth'
import VoteRankModal from '../../components/VoteRankModal'

type SubmissionRow = {
  id: number
  title: string
  competition_table_id: number | null
  video_url: string | null
  fb_url: string | null
  vote_rank_position?: number | null
  author_full_name: string | null
  author_province_name: string | null
  author_ward_name: string | null
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

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function buildExportFilter(tableFilter: string, provinceFilter: string) {
  const filter: Array<{ key: string; operator?: string; value: string | number }> = []

  if (tableFilter !== 'ALL') {
    filter.push({ key: 'competition_table_id', value: Number(tableFilter) })
  }

  if (provinceFilter !== 'ALL') {
    filter.push({ key: 'author_province_name', value: provinceFilter })
  }

  return filter
}

function getExportFileName() {
  return 'submissions.xlsx'
}

export default function TechAdminSubmissions() {
  const { user } = useAuth()
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [tables, setTables] = useState<CompetitionTableRow[]>([])
  const [results, setResults] = useState<ResultRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [page, setPage] = useState(1)
  const [tableFilter, setTableFilter] = useState('ALL')
  const [provinceFilter, setProvinceFilter] = useState('ALL')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  const [sortMode, setSortMode] = useState<'time' | 'score-desc'>('time')
  const [voteRankTarget, setVoteRankTarget] = useState<SubmissionRow | null>(null)
  const [voteRankPosition, setVoteRankPosition] = useState('')
  const [voteRankSaving, setVoteRankSaving] = useState(false)
  const [voteRankError, setVoteRankError] = useState('')
  const canAssignVoteRank = user?.role_code === 'TECH_ADMIN' || user?.role_code === 'TW_ADMIN'

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

  const tableOptions = useMemo(
    () => [...tables].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [tables],
  )

  const provinceOptions = useMemo(() => {
    const map = new Map<string, number>()

    submissions.forEach((row) => {
      const label = row.author_province_name?.trim()
      if (!label) return
      map.set(label, (map.get(label) || 0) + 1)
    })

    return Array.from(map.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'vi'))
  }, [submissions])

  const filteredRows = useMemo(() => {
    const filteredBySelections = submissions.filter((row) => {
      const tableOk = tableFilter === 'ALL' || String(row.competition_table_id || '') === tableFilter
      const provinceOk = provinceFilter === 'ALL' || row.author_province_name === provinceFilter
      return tableOk && provinceOk
    })

    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return filteredBySelections

    return filteredBySelections.filter((row) => {
      const tableName = tableNameById.get(row.competition_table_id || 0) || ''
      return [row.title, row.author_full_name, row.author_province_name, row.author_ward_name, tableName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    })
  }, [submissions, tableFilter, provinceFilter, query, tableNameById])

  const displayedRows = useMemo(() => {
    if (sortMode !== 'score-desc') return filteredRows

    return [...filteredRows].sort((left, right) => {
      const leftScore = toNumber(resultBySubmissionId.get(left.id)?.final_points)
      const rightScore = toNumber(resultBySubmissionId.get(right.id)?.final_points)

      return rightScore - leftScore || right.id - left.id
    })
  }, [filteredRows, resultBySubmissionId, sortMode])

  const totalPages = Math.max(1, Math.ceil(displayedRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedRows = displayedRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [tableFilter, provinceFilter, query])

  const kpiStats = useMemo(() => {
    const regionSet = new Set<string>()

    filteredRows.forEach((row) => {
      const value =
        provinceFilter === 'ALL'
          ? row.author_province_name?.trim()
          : row.author_ward_name?.trim()

      if (value) regionSet.add(value)
    })

    return {
      totalSubmissions: filteredRows.length,
      uniqueRegions: regionSet.size,
    }
  }, [filteredRows, provinceFilter])

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

  function openVoteRankDialog(submission: SubmissionRow) {
    setVoteRankTarget(submission)
    setVoteRankPosition(submission.vote_rank_position ? String(submission.vote_rank_position) : '')
    setVoteRankError('')
    setVoteRankSaving(false)
  }

  function closeVoteRankDialog() {
    setVoteRankTarget(null)
    setVoteRankPosition('')
    setVoteRankError('')
    setVoteRankSaving(false)
  }

  async function handleVoteRankSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!voteRankTarget) return

    const rankPosition = Number(voteRankPosition)
    if (!Number.isInteger(rankPosition) || rankPosition < 0) {
      setVoteRankError('Vui lòng chọn thứ hạng từ Top 1 đến Top 5.')
      return
    }

    setVoteRankSaving(true)
    setVoteRankError('')
    setMessage('')

    try {
      await api.post('/api/v1/vote-rankings/assign-rank', {
        submissionId: voteRankTarget.id,
        rankPosition,
      })
      setMessage('Đã chấm điểm bình chọn.')
      closeVoteRankDialog()
      await loadData()
    } catch (err: unknown) {
      setVoteRankError(normalizeError(err, 'Không chấm điểm bình chọn được.'))
    } finally {
      setVoteRankSaving(false)
    }
  }

  async function handleExportSubmissions() {
    setExporting(true)
    setError('')
    setMessage('')

    try {
      const response = await api.post(
        '/api/v1/export/submissions',
        { filter: buildExportFilter(tableFilter, provinceFilter) },
        { responseType: 'blob' },
      )

      const contentType =
        typeof response.headers?.['content-type'] === 'string'
          ? response.headers['content-type']
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

      downloadBlob(
        new Blob([response.data], {
          type: contentType,
        }),
        getExportFileName(),
      )
      setMessage('File Excel đã sẵn sàng và đang được tải xuống.')
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không xuất được file bài nộp.'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="vb-page vb-dashboard-page vb-tech-submissions-page">
      <Navbar />
      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Hỗ trợ kỹ thuật</p>
          <h1>Quản lý bài nộp</h1>
          <p className="vb-admin-lead">
            Lọc theo bảng thi, tỉnh/thành và tìm kiếm theo tiêu đề, người nộp, phường, bảng thi.
          </p>
        </div>
      </section>

      {error ? <section className="vb-account-banner is-error">{error}</section> : null}
      {message ? <section className="vb-account-banner">{message}</section> : null}
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
          <p className="vb-overline">
            {provinceFilter === 'ALL' ? 'Tỉnh/thành tham gia' : 'Phường tham gia'}
          </p>
          <strong className="vb-province-kpi-value">{kpiStats.uniqueRegions}</strong>
          <span className="vb-province-kpi-label">
            {provinceFilter === 'ALL'
              ? 'Số tỉnh/thành tham gia.'
              : 'Số phường tham gia.'}
          </span>
        </article>
      </section>

      <section className="vb-season-panel">
        <div className="vb-section-head is-compact">
          <div>
            <p className="vb-overline">Danh sách</p>
            <h2>Thông tin bài nộp</h2>
          </div>
          <p className="vb-section-note">{displayedRows.length} bài nộp khớp điều kiện hiện tại.</p>
        </div>

        <div className="vb-tw-toolbar-row">
          <div className="vb-account-search">
            <label htmlFor="tech-submission-search">Tìm kiếm</label>
            <input
              id="tech-submission-search"
              className="vb-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tiêu đề, người nộp, tỉnh/thành, phường, bảng thi..."
            />
          </div>

          <div className="vb-account-filters" style={{ gridColumn: 'auto' }}>
            <div>
              <label htmlFor="tech-table-filter">Bảng thi</label>
              <select
                id="tech-table-filter"
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
              <label htmlFor="tech-province-filter">Tỉnh/Thành</label>
              <select
                id="tech-province-filter"
                className="vb-select"
                value={provinceFilter}
                onChange={(e) => setProvinceFilter(e.target.value)}
              >
                <option value="ALL">Tất cả tỉnh/thành</option>
                {provinceOptions.map((item) => (
                  <option key={item.label} value={item.label}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="vb-tw-toolbar-cta">
            <button
              type="button"
              className="vb-tw-btn-primary"
              onClick={() => void handleExportSubmissions()}
              disabled={exporting}
            >
              {exporting ? 'Đang xuất...' : 'Xuất Excel'}
            </button>
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
                <th>Link Facebook</th>
                <th>Điểm bình chọn</th>
                <th>Điểm bài thi</th>
                <th>
                  <button
                    type="button"
                    className="vb-table-sort-button"
                    onClick={() =>
                      setSortMode((current) => (current === 'score-desc' ? 'time' : 'score-desc'))
                    }
                  >
                    Tổng điểm
                    <span>{sortMode === 'score-desc' ? '↓' : '↕'}</span>
                  </button>
                </th>
                <th>Hành động</th>
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
                    <td>
                      {row.fb_url ? (
                        <a className="vb-tw-btn-link" href={row.fb_url} target="_blank" rel="noreferrer">
                          Xem bài đăng
                        </a>
                      ) : (
                        <span className="vb-status-pill is-inactive">Chưa đăng</span>
                      )}
                    </td>
                    <td>{toNumber(result?.vote_converted_points).toFixed(2)}</td>
                    <td>{toNumber(result?.judge_total_points).toFixed(2)}</td>
                    <td>
                      <strong>{toNumber(result?.final_points).toFixed(2)}</strong>
                    </td>
                    <td>
                      <div className="vb-tw-row-actions">
                        {canAssignVoteRank ? (
                          <button
                            type="button"
                            className="vb-tw-btn-muted"
                            onClick={() => openVoteRankDialog(row)}
                          >
                            Chấm điểm
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="vb-tw-btn-danger"
                          onClick={() => void handleDeleteSubmission(row.id)}
                        >
                          {deletingId === row.id ? 'Đang xóa...' : 'Xóa'}
                        </button>
                      </div>
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

        <VoteRankModal
          open={Boolean(voteRankTarget)}
          submission={voteRankTarget}
          rankPosition={voteRankPosition}
          onRankPositionChange={setVoteRankPosition}
          onClose={closeVoteRankDialog}
          onSubmit={handleVoteRankSubmit}
          saving={voteRankSaving}
          error={voteRankError}
        />
      </section>
    </main>
  )
}
