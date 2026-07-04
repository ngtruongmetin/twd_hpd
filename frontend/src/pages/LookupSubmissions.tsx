import axios from 'axios'
import { useState, type FormEvent } from 'react'
import { api } from '../api/api'
import Navbar from '../components/Navbar'
import ProvinceSelector, { type ProvinceOption } from '../components/ProvinceSelector'
import WardSelector, { type WardOption } from '../components/WardSelector'

type LookupSubmission = {
  id: number
  season_name: string | null
  competition_table_name: string
  submitted_by: string
  title: string
  description: string
  video_url: string
  facebook_post_url: string
  other_members: string
  status: string
  failed_reason: string
  submitted_at: string
  updated_at: string
  submitted_at_display: string
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

function getStatusTone(status: string) {
  if (status === 'Không đạt') return 'failed'
  if (status === 'Đang chờ đăng tải' || status === 'Đang kiểm duyệt') return 'reviewing'
  return 'approved'
}

export default function LookupSubmissions() {
  const [fullName, setFullName] = useState('')
  const [province, setProvince] = useState<ProvinceOption | null>(null)
  const [ward, setWard] = useState<WardOption | null>(null)
  const [results, setResults] = useState<LookupSubmission[]>([])
  const [matchedCount, setMatchedCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const trimmedName = normalizeInput(fullName)
    if (!trimmedName || !province || !ward) {
      setError('Vui lòng nhập họ tên và chọn tỉnh/thành, phường/xã để tra cứu.')
      setSubmitted(false)
      setResults([])
      setMatchedCount(0)
      return
    }

    setLoading(true)
    setError('')
    setSubmitted(true)

    try {
      const response = await api.post('/api/v1/public/submissions/search', {
        full_name: trimmedName,
        province_code: province.code,
        province_name: province.name,
        ward_name: ward.name,
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

  return (
    <main className="vb-page vb-lookup-page">
      <Navbar />

      <section className="vb-card vb-lookup-shell">
        <div className="vb-lookup-copy">
          <p className="vb-overline">Tra cứu thông tin</p>
          <h1>Tra cứu trạng thái bài nộp</h1>
          <p className="vb-lookup-lead">
            Nhập họ tên, chọn tỉnh/thành và phường/xã để xem danh sách bài nộp tương ứng.
          </p>
        </div>

        <form className="vb-lookup-form-card" onSubmit={handleSubmit}>
          <div className="vb-lookup-form-grid">
            <div className="vb-field">
              <input
                id="lookup_full_name"
                className="vb-input"
                placeholder=" "
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="off"
                required
              />
              <label className="vb-float-label" htmlFor="lookup_full_name">
                Họ tên <span className="vb-required">*</span>
              </label>
            </div>

            <ProvinceSelector
              value={province}
              onChange={(nextProvince) => {
                setProvince(nextProvince)
                setWard(null)
              }}
            />

            <WardSelector provinceCode={province?.code ?? null} value={ward} onChange={setWard} />
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
        </div>

        <div className="vb-lookup-table-wrap">
          <table className="vb-lookup-table">
            <thead>
              <tr>
                <th>Bảng thi</th>
                <th>Người nộp</th>
                <th>Tiêu đề</th>
                <th>Mô tả</th>
                <th>Link bài thi</th>
                <th>Link bài đăng Facebook</th>
                <th>Thành viên khác</th>
                <th>Trạng thái bài thi</th>
                <th>Lý do không đạt</th>
                <th>Thời gian nộp bài</th>
              </tr>
            </thead>
            <tbody>
              {results.length > 0 ? (
                results.map((row) => (
                  <tr key={row.id}>
                    <td>{displayValue(row.competition_table_name)}</td>
                    <td>{displayValue(row.submitted_by)}</td>
                    <td>{displayValue(row.title)}</td>
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
                    <td>
                      {row.status === 'Không đạt' ? (
                        'Không được đăng tải'
                      ) : row.facebook_post_url ? (
                        <a className="vb-tw-btn-link" href={row.facebook_post_url} target="_blank" rel="noreferrer">
                          Xem bài đăng Facebook
                        </a>
                      ) : (
                        'Đang chờ đăng tải'
                      )}
                    </td>
                    <td>{displayValue(row.other_members)}</td>
                    <td>
                      <span className={`vb-lookup-status is-${getStatusTone(row.status)}`}>{row.status}</span>
                    </td>
                    <td>{displayValue(row.failed_reason)}</td>
                    <td>{formatSubmissionTime(row.submitted_at_display, row.submitted_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="vb-lookup-empty">
                    {submitted
                      ? 'Không tìm thấy bài thi nào khớp với thông tin đã nhập.'
                      : 'Nhập thông tin rồi bấm Tra cứu để xem kết quả.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="vb-lookup-mobile-list">
          {results.length > 0 ? (
            results.map((row) => (
              <article key={row.id} className="vb-lookup-mobile-card">
                <header className="vb-lookup-mobile-head">
                  <div>
                    <p className="vb-lookup-mobile-kicker">{displayValue(row.competition_table_name)}</p>
                    <h3>{displayValue(row.title)}</h3>
                  </div>
                </header>

                <dl className="vb-lookup-mobile-grid">
                  <div>
                    <dt>Người nộp</dt>
                    <dd>{displayValue(row.submitted_by)}</dd>
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
                    <dd>
                      {row.status === 'Không đạt' ? (
                        'Không được đăng tải'
                      ) : row.facebook_post_url ? (
                        <a className="vb-tw-btn-link" href={row.facebook_post_url} target="_blank" rel="noreferrer">
                          Xem bài đăng Facebook
                        </a>
                      ) : (
                        'Đang chờ đăng tải'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Trạng thái bài thi</dt>
                    <dd>
                      <span className={`vb-lookup-status is-${getStatusTone(row.status)}`}>{row.status}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Thành viên khác</dt>
                    <dd>{displayValue(row.other_members)}</dd>
                  </div>
                  <div>
                    <dt>Lý do không đạt</dt>
                    <dd>{displayValue(row.failed_reason)}</dd>
                  </div>
                  <div>
                    <dt>Thời gian nộp bài</dt>
                    <dd>{formatSubmissionTime(row.submitted_at_display, row.submitted_at)}</dd>
                  </div>
                </dl>
              </article>
            ))
          ) : (
            <div className="vb-lookup-mobile-empty">
              {submitted
                ? 'Không tìm thấy bài thi nào khớp với thông tin đã nhập.'
                : 'Nhập thông tin rồi bấm Tra cứu để xem kết quả.'}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
