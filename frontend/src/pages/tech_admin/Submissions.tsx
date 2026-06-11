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
      setError(normalizeError(err, 'KhÃ´ng táº£i Ä‘Æ°á»£c dá»¯ liá»‡u bÃ i ná»™p.'))
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

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

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
    if (!window.confirm(`XÃ³a bÃ i ná»™p #${id}?`)) return
    setDeletingId(id)
    setError('')
    setMessage('')
    try {
      await api.delete(`/api/v1/submissions/${id}`)
      setMessage('ÄÃ£ xÃ³a bÃ i ná»™p.')
      await loadData()
    } catch (err: unknown) {
      setError(normalizeError(err, 'KhÃ´ng xÃ³a Ä‘Æ°á»£c bÃ i ná»™p.'))
    } finally {
      setDeletingId(null)
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
      setMessage('File Excel Ä‘Ã£ sáºµn sÃ ng vÃ  Ä‘ang Ä‘Æ°á»£c táº£i xuá»‘ng.')
    } catch (err: unknown) {
      setError(normalizeError(err, 'KhÃ´ng xuáº¥t Ä‘Æ°á»£c file bÃ i ná»™p.'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="vb-page vb-dashboard-page vb-tech-submissions-page">
      <Navbar />
      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Quáº£n trá»‹ ká»¹ thuáº­t</p>
          <h1>Quáº£n lÃ½ bÃ i thi vÃ  káº¿t quáº£</h1>
          <p className="vb-admin-lead">
            Xem lá»c theo báº£ng thi, tá»‰nh/thÃ nh vÃ  tÃ¬m kiáº¿m nhanh theo tiÃªu Ä‘á», ngÆ°á»i ná»™p, phÆ°á»ng, báº£ng thi.
          </p>
        </div>
      </section>

      {error ? <section className="vb-account-banner is-error">{error}</section> : null}
      {message ? <section className="vb-account-banner">{message}</section> : null}
      {loading ? <section className="vb-account-banner">Äang táº£i dá»¯ liá»‡u...</section> : null}

      <section className="vb-tw-stats-grid vb-tw-stats-grid-2">
        <article className="vb-season-panel vb-province-kpi-card">
          <p className="vb-overline">BÃ i ná»™p</p>
          <strong className="vb-province-kpi-value">{kpiStats.totalSubmissions}</strong>
          <span className="vb-province-kpi-label">Sá»‘ bÃ i dá»± thi theo bá»™ lá»c hiá»‡n táº¡i.</span>
        </article>
        <article className="vb-season-panel vb-province-kpi-card">
          <p className="vb-overline">
            {provinceFilter === 'ALL' ? 'Tá»‰nh/thÃ nh tham gia' : 'PhÆ°á»ng tham gia'}
          </p>
          <strong className="vb-province-kpi-value">{kpiStats.uniqueRegions}</strong>
          <span className="vb-province-kpi-label">
            {provinceFilter === 'ALL' ? 'Sá»‘ tá»‰nh/thÃ nh tham gia.' : 'Sá»‘ phÆ°á»ng tham gia.'}
          </span>
        </article>
      </section>

      <section className="vb-season-panel">
        <div className="vb-section-head is-compact">
          <div>
            <p className="vb-overline">Danh sÃ¡ch</p>
            <h2>ThÃ´ng tin bÃ i ná»™p</h2>
          </div>
          <p className="vb-section-note">{filteredRows.length} bÃ i ná»™p khá»›p Ä‘iá»u kiá»‡n hiá»‡n táº¡i.</p>
        </div>

        <div className="vb-tw-toolbar-row">
          <div className="vb-account-search">
            <label htmlFor="tech-submission-search">TÃ¬m kiáº¿m</label>
            <input
              id="tech-submission-search"
              className="vb-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="TiÃªu Ä‘á», ngÆ°á»i ná»™p, tá»‰nh/thÃ nh, phÆ°á»ng, báº£ng thi..."
            />
          </div>

          <div className="vb-account-filters" style={{ gridColumn: 'auto' }}>
            <div>
              <label htmlFor="tech-table-filter">Báº£ng thi</label>
              <select
                id="tech-table-filter"
                className="vb-select"
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
              >
                <option value="ALL">Táº¥t cáº£ báº£ng thi</option>
                {tableOptions.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tech-province-filter">Tá»‰nh/ThÃ nh</label>
              <select
                id="tech-province-filter"
                className="vb-select"
                value={provinceFilter}
                onChange={(e) => setProvinceFilter(e.target.value)}
              >
                <option value="ALL">Táº¥t cáº£ tá»‰nh/thÃ nh</option>
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
              {exporting ? 'Äang xuáº¥t...' : 'Xuáº¥t Excel'}
            </button>
          </div>
        </div>

        <div className="vb-account-table-wrap">
          <table className="vb-account-table">
            <thead>
              <tr>
                <th>Báº£ng thi</th>
                <th>NgÆ°á»i ná»™p</th>
                <th>TiÃªu Ä‘á»</th>
                <th>BÃ i thi</th>
                <th>Äiá»ƒm bÃ¬nh chá»n</th>
                <th>Äiá»ƒm bÃ i thi</th>
                <th>Tá»•ng Ä‘iá»ƒm</th>
                <th>XÃ³a</th>
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
                          Xem bÃ i thi
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
                    <td>
                      <button
                        type="button"
                        className="vb-tw-btn-danger"
                        onClick={() => void handleDeleteSubmission(row.id)}
                      >
                        {deletingId === row.id ? 'Äang xÃ³a...' : 'XÃ³a'}
                      </button>
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
            Trang trÆ°á»›c
          </button>
          <span>
            Trang {safePage}/{totalPages}
          </span>
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
