import axios from 'axios'
import { useMemo, useState, type ReactNode, type FormEvent } from 'react'
import { api } from '../api/api'
import Navbar from '../components/Navbar'

type MatchReasonKey = 'submitted_by' | 'school_name' | 'province_name' | 'title'
type LookupStatusCode = 'passed' | 'reviewing' | 'failed'

type MatchReason = {
  key: MatchReasonKey
  label: string
  value: string
}

type LookupSubmission = {
  id: number
  season_name: string | null
  competition_table_id: number | null
  competition_table_name: string
  submitted_by: string
  school_name: string
  province_name: string
  ward_name: string
  title: string
  description: string
  video_url: string
  facebook_post_url: string
  has_facebook_post: boolean
  status: string
  status_code: LookupStatusCode
  failed_reason: string
  submitted_at: string
  updated_at: string
  submitted_at_display: string
  match_reasons: MatchReason[]
  interaction_count: number
  share_count: number
  engagement_score: number
  vote_rank_position: number | null
  vote_converted_points: number
}

type LookupResponse = {
  success: boolean
  message?: string
  data?: {
    matched_count?: number
    items?: LookupSubmission[]
  }
}

function normalizeInput(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeSearchText(value: string) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0111\u0110]/g, 'd')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function displayValue(value: string | null | undefined) {
  const text = String(value ?? '').trim()
  return text || 'Không có'
}

function formatSubmissionTime(value: string, fallback: string) {
  const text = String(value ?? '').trim()
  if (text) {
    return text
  }
  return fallback || 'Không có'
}

function getStatusTone(statusCode: LookupStatusCode) {
  if (statusCode === 'failed') return 'failed'
  if (statusCode === 'reviewing') return 'reviewing'
  return 'approved'
}

function buildHighlightRanges(value: string, query: string) {
  const tokens = Array.from(new Set(normalizeSearchText(query).split(' ').filter(Boolean)))
  if (!value.trim() || tokens.length === 0) {
    return []
  }

  const ranges: Array<[number, number]> = []
  const matches = value.matchAll(/[\p{L}\p{N}]+/gu)

  for (const match of matches) {
    const word = match[0]
    const start = match.index ?? 0
    const end = start + word.length
    const normalizedWord = normalizeSearchText(word)

    if (!normalizedWord) continue

    if (tokens.some((token) => normalizedWord.startsWith(token))) {
      ranges.push([start, end])
    }
  }

  if (ranges.length === 0) {
    return []
  }

  ranges.sort((left, right) => left[0] - right[0] || left[1] - right[1])

  return ranges.reduce<Array<[number, number]>>((result, current) => {
    const previous = result[result.length - 1]
    if (!previous || current[0] > previous[1]) {
      result.push([...current])
      return result
    }

    previous[1] = Math.max(previous[1], current[1])
    return result
  }, [])
}

function renderHighlightedText(value: string | null | undefined, query: string, shouldHighlight: boolean) {
  const text = String(value ?? '').trim()
  if (!text) {
    return 'Không có'
  }

  if (!shouldHighlight) {
    return text
  }

  const ranges = buildHighlightRanges(text, query)
  if (ranges.length === 0) {
    return text
  }

  const fragments: ReactNode[] = []
  let cursor = 0

  ranges.forEach(([start, end], index) => {
    if (cursor < start) {
      fragments.push(<span key={`text-${index}-${cursor}`}>{text.slice(cursor, start)}</span>)
    }

    fragments.push(
      <mark key={`mark-${index}-${start}`} className="vb-lookup-highlight">
        {text.slice(start, end)}
      </mark>,
    )
    cursor = end
  })

  if (cursor < text.length) {
    fragments.push(<span key={`tail-${cursor}`}>{text.slice(cursor)}</span>)
  }

  return fragments
}

function getFacebookDisplay(row: LookupSubmission) {
  if (row.status_code === 'failed') {
    return 'Không được đăng tải'
  }

  if (row.facebook_post_url) {
    return (
      <a className="vb-tw-btn-link" href={row.facebook_post_url} target="_blank" rel="noreferrer">
        Xem bài đăng Facebook
      </a>
    )
  }

  return 'Đang chờ đăng tải'
}

function getEmptyMessage(submitted: boolean, hasAnyResult: boolean) {
  if (!submitted) {
    return 'Nhập từ khóa rồi bấm Tra cứu để xem kết quả.'
  }

  if (hasAnyResult) {
    return 'Không còn bài thi nào phù hợp với bộ lọc hiện tại.'
  }

  return 'Không tìm thấy bài thi nào khớp với từ khóa đã nhập.'
}

function hasMatchReason(row: LookupSubmission, key: MatchReasonKey) {
  return row.match_reasons.some((reason) => reason.key === key)
}

export default function LookupSubmissions() {
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [results, setResults] = useState<LookupSubmission[]>([])
  const [matchedCount, setMatchedCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [tableFilter, setTableFilter] = useState('ALL')
  const [provinceFilter, setProvinceFilter] = useState('ALL')
  const [facebookFilter, setFacebookFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const trimmedQuery = normalizeInput(query)
    if (!trimmedQuery) {
      setError('Vui lòng nhập từ khóa để tra cứu.')
      setSubmitted(false)
      setSubmittedQuery('')
      setResults([])
      setMatchedCount(0)
      return
    }

    setLoading(true)
    setError('')
    setSubmitted(true)
    setSubmittedQuery(trimmedQuery)
    setTableFilter('ALL')
    setProvinceFilter('ALL')
    setFacebookFilter('ALL')
    setStatusFilter('ALL')

    try {
      const response = await api.post('/api/v1/public/submissions/search', {
        query: trimmedQuery,
      })

      const payload = response.data as LookupResponse
      const items = payload.data?.items ?? []
      setResults(items)
      setMatchedCount(Number(payload.data?.matched_count ?? items.length))
    } catch (err: unknown) {
      setResults([])
      setMatchedCount(0)
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || 'Không tra cứu được bài thi.')
      } else {
        setError('Không tra cứu được bài thi.')
      }
    } finally {
      setLoading(false)
    }
  }

  const tableOptions = useMemo(() => {
    const map = new Map<number, string>()

    results.forEach((row) => {
      if (!row.competition_table_id) return
      map.set(row.competition_table_id, row.competition_table_name)
    })

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, 'vi', { sensitivity: 'base' }))
  }, [results])

  const provinceOptions = useMemo(() => {
    const map = new Map<string, number>()

    results.forEach((row) => {
      const label = row.province_name.trim()
      if (!label) return
      map.set(label, (map.get(label) || 0) + 1)
    })

    return Array.from(map.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label, 'vi', { sensitivity: 'base' }))
  }, [results])

  const filteredRows = useMemo(() => {
    return results.filter((row) => {
      const tableOk = tableFilter === 'ALL' || String(row.competition_table_id || '') === tableFilter
      const provinceOk = provinceFilter === 'ALL' || row.province_name === provinceFilter
      const facebookOk =
        facebookFilter === 'ALL' ||
        (facebookFilter === 'HAS' ? row.has_facebook_post : !row.has_facebook_post)
      const statusOk = statusFilter === 'ALL' || row.status_code === statusFilter

      return tableOk && provinceOk && facebookOk && statusOk
    })
  }, [results, tableFilter, provinceFilter, facebookFilter, statusFilter])

  const resultsNote = useMemo(() => {
    if (!submitted) {
      return 'Chưa có kết quả nào được tra cứu. Vui lòng nhập từ khóa và bấm Tra cứu.'
    }

    if (results.length === 0) {
      return 'Chưa có bài nộp nào khớp với từ khóa hiện tại.'
    }

    if (filteredRows.length === results.length) {
      return `${matchedCount} bài nộp đang hiển thị.`
    }

    return `${filteredRows.length}/${matchedCount} bài nộp đang hiển thị sau khi lọc.`
  }, [filteredRows.length, matchedCount, results.length, submitted])

  const emptyMessage = getEmptyMessage(submitted, results.length > 0)

  return (
    <main className="vb-page vb-lookup-page">
      <Navbar />

      <section className="vb-card vb-lookup-shell">
        <div className="vb-lookup-copy">
          <p className="vb-overline">Tra cứu thông tin</p>
          <h1>Tra cứu trạng thái bài nộp</h1>
        </div>

        <form className="vb-lookup-form-card" onSubmit={handleSubmit}>
          <div className="vb-lookup-search-row">
            <div className="vb-account-search">
              <label htmlFor="lookup_query">Tìm kiếm</label>
              <input
                id="lookup_query"
                className="vb-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                placeholder="Tên người nộp, trường học, tỉnh/thành, tên bài thi"
                required
              />
            </div>
          </div>

          {error ? <p className="vb-form-error vb-lookup-error">{error}</p> : null}

          <div className="vb-lookup-actions">
            <button type="submit" className="vb-btn vb-btn-primary" disabled={loading}>
              {loading ? 'Đang tra cứu...' : 'Tra cứu'}
            </button>
          </div>
        </form>
      </section>

      <section className="vb-lookup-results">
        <div className="vb-lookup-results-head">
          <div>
            <p className="vb-overline">Kết quả</p>
            <h2>{submitted ? `${matchedCount} bài nộp được tìm thấy` : 'Chưa tra cứu'}</h2>
          </div>
          <p className="vb-lookup-results-note">{resultsNote}</p>
        </div>

        {submitted && results.length > 0 ? (
          <div className="vb-account-filters vb-lookup-results-filters">
            <div>
              <label htmlFor="lookup-table-filter">Bảng thi</label>
              <select
                id="lookup-table-filter"
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
              <label htmlFor="lookup-province-filter">Tỉnh/Thành</label>
              <select
                id="lookup-province-filter"
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
            <div>
              <label htmlFor="lookup-facebook-filter">Bài đăng Facebook</label>
              <select
                id="lookup-facebook-filter"
                className="vb-select"
                value={facebookFilter}
                onChange={(e) => setFacebookFilter(e.target.value)}
              >
                <option value="ALL">Tất cả</option>
                <option value="HAS">Đã có bài đăng</option>
                <option value="NO">Chưa có bài đăng</option>
              </select>
            </div>
            <div>
              <label htmlFor="lookup-status-filter">Trạng thái</label>
              <select
                id="lookup-status-filter"
                className="vb-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="passed">Đạt</option>
                <option value="reviewing">Đang kiểm duyệt</option>
                <option value="failed">Không đạt</option>
              </select>
            </div>
          </div>
        ) : null}

        <div className="vb-account-table-wrap vb-lookup-desktop-table">
          <table className="vb-account-table">
            <thead>
              <tr>
                <th>Bảng thi</th>
                <th>Người nộp</th>
                <th>Trường học</th>
                <th>Tỉnh/Thành</th>
                <th>Phường/Xã</th>
                <th>Tiêu đề</th>
                <th>Mô tả</th>
                <th>Link bài thi</th>
                <th>Link bài đăng Facebook</th>
                <th>Trạng thái bài thi</th>
                <th>Lý do không đạt</th>
                <th>Thời gian nộp bài</th>
                <th>Lượt tương tác</th>
                <th>Lượt share</th>
                <th>Hạng bình chọn</th>
                <th>Điểm bình chọn</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{displayValue(row.competition_table_name)}</td>
                    <td>{renderHighlightedText(row.submitted_by, submittedQuery, hasMatchReason(row, 'submitted_by'))}</td>
                    <td>{renderHighlightedText(row.school_name, submittedQuery, hasMatchReason(row, 'school_name'))}</td>
                    <td>{renderHighlightedText(row.province_name, submittedQuery, hasMatchReason(row, 'province_name'))}</td>
                    <td>{displayValue(row.ward_name)}</td>
                    <td>{renderHighlightedText(row.title, submittedQuery, hasMatchReason(row, 'title'))}</td>
                    <td>{displayValue(row.description)}</td>
                    <td>
                      {row.video_url ? (
                        <a className="vb-tw-btn-link" href={row.video_url} target="_blank" rel="noreferrer">
                          Xem bài thi
                        </a>
                      ) : (
                        'Không có'
                      )}
                    </td>
                    <td>{getFacebookDisplay(row)}</td>
                    <td>
                      <span className={`vb-lookup-status is-${getStatusTone(row.status_code)}`}>{row.status}</span>
                    </td>
                    <td>{displayValue(row.failed_reason)}</td>
                    <td>{formatSubmissionTime(row.submitted_at_display, row.submitted_at)}</td>
                    <td>{row.interaction_count}</td>
                    <td>{row.share_count}</td>
                    <td>{row.vote_rank_position ? (row.vote_rank_position <= 5 ? `Top ${row.vote_rank_position}` : `Hạng ${row.vote_rank_position}`) : 'Chưa xếp hạng'}</td>
                    <td>{row.vote_converted_points}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={16} className="vb-lookup-empty">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="vb-lookup-mobile-list">
          {filteredRows.length > 0 ? (
            filteredRows.map((row) => (
              <article key={row.id} className="vb-lookup-mobile-card">
                <header className="vb-lookup-mobile-head">
                  <div>
                    <p className="vb-lookup-mobile-kicker">{displayValue(row.competition_table_name)}</p>
                    <h3>{renderHighlightedText(row.title, submittedQuery, hasMatchReason(row, 'title'))}</h3>
                  </div>
                </header>

                <dl className="vb-lookup-mobile-grid">
                  <div>
                    <dt>Người nộp</dt>
                    <dd>{renderHighlightedText(row.submitted_by, submittedQuery, hasMatchReason(row, 'submitted_by'))}</dd>
                  </div>
                  <div>
                    <dt>Trường học</dt>
                    <dd>{renderHighlightedText(row.school_name, submittedQuery, hasMatchReason(row, 'school_name'))}</dd>
                  </div>
                  <div>
                    <dt>Tỉnh/Thành</dt>
                    <dd>{renderHighlightedText(row.province_name, submittedQuery, hasMatchReason(row, 'province_name'))}</dd>
                  </div>
                  <div>
                    <dt>Phường/Xã</dt>
                    <dd>{displayValue(row.ward_name)}</dd>
                  </div>
                  <div>
                    <dt>Mô tả</dt>
                    <dd>{displayValue(row.description)}</dd>
                  </div>
                  <div>
                    <dt>Link bài thi</dt>
                    <dd>
                      {row.video_url ? (
                        <a className="vb-tw-btn-link" href={row.video_url} target="_blank" rel="noreferrer">
                          Xem bài thi
                        </a>
                      ) : (
                        'Không có'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Link bài đăng Facebook</dt>
                    <dd>{getFacebookDisplay(row)}</dd>
                  </div>
                  <div>
                    <dt>Trạng thái bài thi</dt>
                    <dd>
                      <span className={`vb-lookup-status is-${getStatusTone(row.status_code)}`}>{row.status}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Lý do không đạt</dt>
                    <dd>{displayValue(row.failed_reason)}</dd>
                  </div>
                  <div>
                    <dt>Thời gian nộp bài</dt>
                    <dd>{formatSubmissionTime(row.submitted_at_display, row.submitted_at)}</dd>
                  </div>
                  <div><dt>Lượt tương tác</dt><dd>{row.interaction_count}</dd></div>
                  <div><dt>Lượt share</dt><dd>{row.share_count}</dd></div>
                  <div><dt>Hạng bình chọn</dt><dd>{row.vote_rank_position ? (row.vote_rank_position <= 5 ? `Top ${row.vote_rank_position}` : `Hạng ${row.vote_rank_position}`) : 'Chưa xếp hạng'}</dd></div>
                  <div><dt>Điểm bình chọn</dt><dd>{row.vote_converted_points}</dd></div>
                </dl>
              </article>
            ))
          ) : (
            <div className="vb-lookup-mobile-empty">{emptyMessage}</div>
          )}
        </div>
      </section>
    </main>
  )
}
