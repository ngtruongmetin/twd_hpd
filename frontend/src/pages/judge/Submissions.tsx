import axios from 'axios'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Navbar from '../../components/Navbar'
import { api } from '../../api/api'
import { useAuth } from '../../context/useAuth'

type SubmissionRow = {
  id: number
  title: string
  competition_table_id: number | null
  video_url: string | null
  author_full_name: string | null
  description: string | null
  fb_url: string | null
}

type CompetitionTableRow = {
  id: number
  name: string
}

type CriterionRow = {
  id: number
  competition_table_id: number
  name: string
  max_points: number | string
  sort_order?: number | null
}

type JudgeScoreRow = {
  id: number
  submission_id: number
  judge_user_id: number
  criterion_id: number
  points: number | string
  comment: string | null
  judge_username?: string
  judge_full_name?: string
}
type SubmissionResultRow = {
  id?: number | string
  submission_id: number
  judge_total_points: number | string
  vote_converted_points: number | string
  final_points: number | string
}
type SubmissionScoreResponse = {
  scores: JudgeScoreRow[]
  totals: Array<{
    judge_user_id: number
    total_points: number | string
  }>
}

type StatusEntry = {
  hasScores: boolean
  judgeUsername?: string
  judgeFullName?: string
}

type CriterionDraft = {
  criterionId: number
  name: string
  maxPoints: number
  points: string
  comment: string
}

const PAGE_SIZE = 10

function normalizeError(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) return err.response?.data?.message || fallback
  return fallback
}

function toNumber(value: number | string | null | undefined) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}



function statusClass(hasScores: boolean) {
  return hasScores ? 'is-active' : 'is-inactive'
}

export default function JudgeSubmissions() {
  const { user } = useAuth()
  const judgeUserId = Number(user?.id || 0)
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [tables, setTables] = useState<CompetitionTableRow[]>([])
  const [results, setResults] = useState<SubmissionResultRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [page, setPage] = useState(1)
  const [tableFilter, setTableFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [submissionStatusMap, setSubmissionStatusMap] = useState<Record<number, StatusEntry>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionRow | null>(null)
  const [criteriaLoading, setCriteriaLoading] = useState(false)
  const [savingScores, setSavingScores] = useState(false)
  const [criteriaDrafts, setCriteriaDrafts] = useState<CriterionDraft[]>([])
  const [modalError, setModalError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({})

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [submissionRes, tableRes, resultsRes] = await Promise.all([
        api.get('/api/v1/submissions'),
        api.get('/api/v1/competition_tables'),
        api.get('/api/v1/submission_results'),
      ])
      setSubmissions((submissionRes.data?.data ?? []) as SubmissionRow[])
      setTables((tableRes.data?.data ?? []) as CompetitionTableRow[])
      setResults((resultsRes.data?.data ?? []) as SubmissionResultRow[])
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không tải được danh sách bài dự thi.'))
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
  const resultBySubmissionId = useMemo(() => {
    const map = new Map<number, SubmissionResultRow>()

    results.forEach((result) => {
      map.set(Number(result.submission_id), result)
    })

    return map
  }, [results])
  const statusRows = useMemo(
    () =>
      submissions.filter(
        (row) => tableFilter === 'ALL' || String(row.competition_table_id || '') === tableFilter,
      ),
    [submissions, tableFilter],
  )

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return statusRows.filter((row) => {
      if (!normalizedQuery) return true

      const status = submissionStatusMap[row.id]
      return [tableNameById.get(row.competition_table_id || 0), row.title, status?.judgeUsername, status?.judgeFullName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    })
  }, [statusRows, query, submissionStatusMap, tableNameById])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedRows = useMemo(
    () => filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredRows, safePage],
  )

  useEffect(() => {
    setPage(1)
  }, [tableFilter, query])

  useEffect(() => {
    let active = true

    async function loadStatuses() {
      if (statusRows.length === 0) {
        if (active) setSubmissionStatusMap({})
        return
      }

      try {
        const responses = await Promise.all(
          statusRows.map(async (submission) => {
            const response = await api.get(`/api/v1/judge_scores/submission/${submission.id}`)
            return {
              id: submission.id,
              data: response.data?.data as SubmissionScoreResponse | undefined,
            }
          }),
        )

        if (!active) return

        const nextStatusMap: Record<number, StatusEntry> = {}
        responses.forEach(({ id, data }) => {
          const judgeScore = data?.scores?.find(
            (score) => Number(score.judge_user_id) === judgeUserId,
          )

          const hasScores = Boolean(judgeScore)

          nextStatusMap[id] = {
            hasScores,
            judgeUsername: judgeScore?.judge_username,
            judgeFullName: judgeScore?.judge_full_name,
          }
        })
        setSubmissionStatusMap(nextStatusMap)
      } catch {
        if (active) setSubmissionStatusMap({})
      }
    }

    void loadStatuses()

    return () => {
      active = false
    }
  }, [judgeUserId, statusRows])

  function resetModalState() {
    setModalError('')
    setFieldErrors({})
    setCriteriaDrafts([])
    setSelectedSubmission(null)
    setModalOpen(false)
  }

  async function openScoreModal(submission: SubmissionRow) {
    setModalOpen(true)
    setSelectedSubmission(submission)
    setCriteriaLoading(true)
    setModalError('')
    setFieldErrors({})
    setCriteriaDrafts([])

    try {
      const [criteriaRes, scoreRes] = await Promise.all([
        api.get('/api/v1/scoring_criteria'),
        api.get(`/api/v1/judge_scores/submission/${submission.id}`),
      ])

      const criteria = ((criteriaRes.data?.data ?? []) as CriterionRow[])
        .filter((criterion) => criterion.competition_table_id === submission.competition_table_id)
        .sort((left, right) => (left.sort_order || 0) - (right.sort_order || 0) || left.id - right.id)

      if (criteria.length === 0) {
        setModalError('Bảng thi này chưa có tiêu chí chấm điểm.')
        return
      }

      const existingScores = ((scoreRes.data?.data?.scores ?? []) as JudgeScoreRow[]).filter(
        (score) => Number(score.judge_user_id) === judgeUserId,
      )
      const scoreMap = new Map<number, JudgeScoreRow>()
      existingScores.forEach((score) => scoreMap.set(Number(score.criterion_id), score))

      setCriteriaDrafts(
        criteria.map((criterion) => {
          const existing = scoreMap.get(criterion.id)
          return {
            criterionId: criterion.id,
            name: criterion.name,
            maxPoints: toNumber(criterion.max_points),
            points: existing ? String(existing.points) : '',
            comment: existing?.comment || '',
          }
        }),
      )
    } catch (err: unknown) {
      setModalError(normalizeError(err, 'Không tải được tiêu chí chấm điểm.'))
    } finally {
      setCriteriaLoading(false)
    }
  }

  async function handleSaveScores(event: FormEvent) {
    event.preventDefault()
    if (!selectedSubmission) return

    const nextFieldErrors: Record<number, string> = {}
    const payloadScores = criteriaDrafts
      .map((item) => {
        const rawPoints = item.points.trim()
        if (rawPoints === '') {
          return null
        }

        const points = Number(rawPoints)
        if (Number.isNaN(points)) {
          nextFieldErrors[item.criterionId] = 'Điểm không hợp lệ.'
          return null
        }

        if (points < 0 || points > item.maxPoints) {
          nextFieldErrors[item.criterionId] = `Điểm phải từ 0 đến ${item.maxPoints}.`
          return null
        }

        return {
          criterion_id: item.criterionId,
          points,
          comment: item.comment.trim() || null,
        }
      })
      .filter((item): item is { criterion_id: number; points: number; comment: string | null } => item !== null)

    setFieldErrors(nextFieldErrors)

    if (criteriaDrafts.length === 0) {
      setModalError('Không có tiêu chí chấm điểm cho bảng thi này.')
      return
    }

    if (payloadScores.length === 0) {
      setModalError('Vui lòng nhập ít nhất một tiêu chí trước khi lưu.')
      return
    }

    setSavingScores(true)
    setModalError('')
    setMessage('')

    try {
      await api.post('/api/v1/judge_scores', {
        submission_id: selectedSubmission.id,
        scores: payloadScores,
      })
      setMessage('Đã lưu điểm chấm.')
      resetModalState()
      await loadData()
    } catch (err: unknown) {
      setModalError(normalizeError(err, 'Không lưu được điểm chấm.'))
    } finally {
      setSavingScores(false)
    }
  }



  return (
    <main className="vb-page vb-dashboard-page vb-tw-submissions-page">
      <Navbar />
      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Giám khảo</p>
          <h1>Chấm điểm bài dự thi</h1>
          <p className="vb-admin-lead">
            Xem danh sách bài dự thi và thực hiện chấm điểm theo các tiêu chí của từng bảng thi.
          </p>
        </div>
      </section>

      {error ? <section className="vb-account-banner is-error">{error}</section> : null}
      {message ? <section className="vb-account-banner">{message}</section> : null}
      {loading ? <section className="vb-account-banner">Đang tải dữ liệu...</section> : null}

      <section className="vb-season-panel">
        <div className="vb-section-head is-compact">
          <div>
            <p className="vb-overline">Danh sách</p>
            <h2>Bài dự thi</h2>
          </div>
          <p className="vb-section-note">{filteredRows.length} bài dự thi khớp điều kiện hiện tại.</p>
        </div>

        <div className="vb-tw-toolbar-row">
          <div className="vb-account-search">
            <label htmlFor="judge-submission-search">Tìm kiếm</label>
            <input
              id="judge-submission-search"
              className="vb-input"
              placeholder="Tên bảng thi, tiêu đề, username, họ tên người chấm..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="vb-tw-role-filter">
            <label htmlFor="judge-table-filter">Bảng thi</label>
            <select
              id="judge-table-filter"
              className="vb-toolbar-select"
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

        <div className="vb-account-table-wrap">
          <table className="vb-account-table">
            <thead>
              <tr>
                <th>Bảng thi</th>
                <th>Tiêu đề</th>
                <th>Link bài thi</th>
                <th>Link Facebook</th>
                <th>Điểm bình chọn</th>
                <th>Điểm bài thi</th>
                <th>Tổng điểm</th>
                <th>Trạng thái chấm</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => {
                const hasScores = submissionStatusMap[row.id]?.hasScores ?? false
                const result = resultBySubmissionId.get(Number(row.id))
                const judgeLabel =
                  submissionStatusMap[row.id]?.judgeUsername ||
                  submissionStatusMap[row.id]?.judgeFullName ||
                  ''
                return (
                  <tr key={row.id}>
                    <td>{tableNameById.get(row.competition_table_id || 0) || 'N/A'}</td>
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
                        >
                          Xem bài đăng
                        </a>
                      ) : (
                        <span className="vb-status-pill is-inactive">
                          Chưa được đăng
                        </span>
                      )}
                    </td>
                    <td>
                      {toNumber(result?.vote_converted_points).toFixed(2)}
                    </td>

                    <td>
                      {toNumber(result?.judge_total_points).toFixed(2)}
                    </td>

                    <td>
                      <strong>
                        {toNumber(result?.final_points).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      <span className={`vb-status-pill ${statusClass(hasScores)}`}>
                        {hasScores
                          ? `Đã chấm bởi ${judgeLabel}`
                          : 'Chưa chấm'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="vb-tw-btn-primary"
                        onClick={() => void openScoreModal(row)}
                      >
                        Chấm điểm
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

      {modalOpen && selectedSubmission ? (
        <div className="vb-modal-backdrop" role="presentation" onClick={resetModalState}>
          <section
            className="vb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="judge-score-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="vb-modal-head">
              <div>
                <p className="vb-overline">Chấm điểm</p>

                <h2 id="judge-score-title">
                  {selectedSubmission.title}
                </h2>

                <p className="vb-modal-sub">
                  Tác giả: {selectedSubmission.author_full_name || 'N/A'}
                </p>

                {selectedSubmission.description ? (
                  <p className="vb-modal-description">
                    {selectedSubmission.description}
                  </p>
                ) : null}
              </div>
              <button type="button" className="vb-modal-close" onClick={resetModalState}>
                Đóng
              </button>
            </div>

            <form className="vb-modal-body vb-modal-form" onSubmit={handleSaveScores}>
              <div className="vb-modal-layout">
                <div className="vb-modal-main">
                  <section className="vb-modal-section">
                    <div className="vb-modal-section-head">
                      <div>
                        <p className="vb-overline">Tiêu chí</p>
                        <h3>Nhập điểm và nhận xét</h3>
                      </div>
                    </div>

                    {criteriaLoading ? (
                      <p className="vb-account-banner">
                        Đang tải tiêu chí chấm điểm...
                      </p>
                    ) : (
                      <>
                        {modalError ? (
                          <p className="vb-account-banner is-error">
                            {modalError}
                          </p>
                        ) : null}

                        <div className="vb-judge-criteria-list">
                          {criteriaDrafts.map((criterion, index) => (
                            <article
                              key={criterion.criterionId}
                              className="vb-judge-criterion-card"
                            >
                              <div className="vb-judge-criterion-head">
                                <div>
                                  <p className="vb-overline">
                                    Tiêu chí {index + 1}
                                  </p>
                                  <h4>{criterion.name}</h4>
                                </div>

                                <span className="vb-role-pill">
                                  Tối đa {criterion.maxPoints}
                                </span>
                              </div>

                              <div className="vb-judge-criterion-grid">
                                <div className="vb-field">
                                  <input
                                    className="vb-input"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max={criterion.maxPoints}
                                    placeholder=" "
                                    value={criterion.points}
                                    onChange={(e) => {
                                      setModalError('')

                                      setFieldErrors((prev) => {
                                        if (!prev[criterion.criterionId]) {
                                          return prev
                                        }

                                        const next = { ...prev }
                                        delete next[criterion.criterionId]
                                        return next
                                      })

                                      setCriteriaDrafts((prev) =>
                                        prev.map((item) =>
                                          item.criterionId === criterion.criterionId
                                            ? {
                                              ...item,
                                              points: e.target.value,
                                            }
                                            : item,
                                        ),
                                      )
                                    }}
                                  />

                                  <label className="vb-float-label">
                                    Điểm
                                  </label>

                                  {fieldErrors[criterion.criterionId] ? (
                                    <p className="vb-judge-field-error">
                                      {fieldErrors[criterion.criterionId]}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="vb-field vb-full">
                                  <textarea
                                    className="vb-input vb-textarea"
                                    placeholder=" "
                                    value={criterion.comment}
                                    onChange={(e) => {
                                      setModalError('')

                                      setCriteriaDrafts((prev) =>
                                        prev.map((item) =>
                                          item.criterionId === criterion.criterionId
                                            ? {
                                              ...item,
                                              comment: e.target.value,
                                            }
                                            : item,
                                        ),
                                      )
                                    }}
                                  />

                                  <label className="vb-float-label">
                                    Nhận xét
                                  </label>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      </>
                    )}
                  </section>
                </div>


              </div>

              <div className="vb-modal-actions">
                <button
                  type="submit"
                  className="vb-tw-btn-primary"
                  disabled={savingScores || criteriaLoading}
                >
                  {savingScores ? 'Đang lưu...' : 'Lưu điểm'}
                </button>

                <button
                  type="button"
                  className="vb-tw-btn-muted"
                  onClick={resetModalState}
                >
                  Hủy
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  )
}
