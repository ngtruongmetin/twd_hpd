import axios from 'axios'
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import Navbar from '../../components/Navbar'
import { api } from '../../api/api'
import { useAuth } from '../../context/useAuth'
import VoteRankModal from '../../components/VoteRankModal'
import ComplaintChatModal, {
  type ComplaintSummary,
} from '../../components/ComplaintChatModal'
import { complaintStatusClass, complaintStatusLabel, type ComplaintStatus } from '../../components/complaintStatus'

type SubmissionRow = {
  id: number
  title: string
  submitted_at: string | null
  competition_table_id: number | null
  video_url: string | null
  fb_url: string | null
  author_full_name: string | null
  author_province_name: string | null
  author_ward_name: string | null
  is_failed: number
  failed_reason: string | null
  interaction_count?: number | null
  share_count?: number | null
  engagement_score?: number | null
  vote_rank_position?: number | null
  vote_converted_points?: number | null
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

type ImportTopRow = {
  submission_id: number
  rank_position: number
  title: string
  author_full_name: string | null
  engagement_score: number
  interaction_count: number
  share_count: number
  converted_points: number
}

type ImportRankingSummary = {
  competition_table_id: number
  competition_table_name: string
  ranked_count: number
  top5: ImportTopRow[]
}

type SortKey = 'time' | 'table' | 'author' | 'title' | 'submittedAt' | 'facebook' | 'vote' | 'judge' | 'total' | 'status'
type SortDirection = 'desc' | 'asc' | 'time'

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

function buildExportFilter(
  tableFilter: string,
  provinceFilter: string,
  facebookFilter: string,
  statusFilter: string,
) {
  const filter: Array<{ key: string; operator?: string; value: string | number }> = []

  if (tableFilter !== 'ALL') {
    filter.push({ key: 'competition_table_id', value: Number(tableFilter) })
  }

  if (provinceFilter !== 'ALL') {
    filter.push({ key: 'author_province_name', value: provinceFilter })
  }

  if (facebookFilter === 'HAS') {
    filter.push({ key: 'fb_url', operator: 'IS NOT NULL', value: 1 })
  } else if (facebookFilter === 'NO') {
    filter.push({ key: 'fb_url', operator: 'IS NULL', value: 1 })
  }

  if (statusFilter === 'PASS') {
    filter.push({ key: 'is_failed', value: 0 })
  } else if (statusFilter === 'FAIL') {
    filter.push({ key: 'is_failed', value: 1 })
  }

  return filter
}

function getExportFileName() {
  return 'submissions.xlsx'
}

function parseUtcTimestamp(value: string) {
  const isoLike = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/,
  )

  if (isoLike) {
    const [, year, month, day, hour, minute, second = '0'] = isoLike
    return Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    )
  }

  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatSubmittedAt(value: string | null | undefined) {
  if (!value) return 'N/A'

  const timestamp = parseUtcTimestamp(value)
  if (!timestamp) return 'N/A'

  const pad = (input: number) => String(input).padStart(2, '0')
  const utc7Timestamp = timestamp + 7 * 60 * 60 * 1000
  const utc7Date = new Date(utc7Timestamp)

  return `${pad(utc7Date.getUTCHours())}:${pad(utc7Date.getUTCMinutes())} ${utc7Date.getUTCDate()}/${utc7Date.getUTCMonth() + 1}`
}

function compareText(leftValue: string, rightValue: string, direction: Exclude<SortDirection, 'time'>) {
  const left = leftValue.trim()
  const right = rightValue.trim()
  const result = left.localeCompare(right, 'vi', { sensitivity: 'base' })
  return direction === 'desc' ? -result : result
}

function compareDate(leftValue: string | null | undefined, rightValue: string | null | undefined, direction: Exclude<SortDirection, 'time'>) {
  const leftTime = leftValue ? parseUtcTimestamp(leftValue) : 0
  const rightTime = rightValue ? parseUtcTimestamp(rightValue) : 0
  return direction === 'desc' ? rightTime - leftTime : leftTime - rightTime
}

function compareNumber(leftValue: number, rightValue: number, direction: Exclude<SortDirection, 'time'>) {
  return direction === 'desc' ? rightValue - leftValue : leftValue - rightValue
}

function compareLink(leftValue: string, rightValue: string, direction: Exclude<SortDirection, 'time'>) {
  const leftHas = Boolean(leftValue.trim())
  const rightHas = Boolean(rightValue.trim())

  if (leftHas !== rightHas) {
    return direction === 'desc'
      ? Number(rightHas) - Number(leftHas)
      : Number(leftHas) - Number(rightHas)
  }

  return compareText(leftValue, rightValue, direction)
}

function getDefaultSortDirection(key: Exclude<SortKey, 'time'>): Exclude<SortDirection, 'time'> {
  if (key === 'table' || key === 'author' || key === 'title' || key === 'submittedAt' || key === 'status') return 'asc'
  return 'desc'
}



export default function TwAdminSubmissions() {
  const { user } = useAuth()
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [complaintSummaries, setComplaintSummaries] = useState<Record<number, ComplaintSummary>>({})
  const [tables, setTables] = useState<CompetitionTableRow[]>([])
  const [results, setResults] = useState<ResultRow[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [publishTarget, setPublishTarget] = useState<SubmissionRow | null>(null)
  const [publishLink, setPublishLink] = useState('')
  const [publishError, setPublishError] = useState('')
  const [publishLoading, setPublishLoading] = useState(false)
  const [voteRankTarget, setVoteRankTarget] = useState<SubmissionRow | null>(null)
  const [voteRankPosition, setVoteRankPosition] = useState('')
  const [failureTarget, setFailureTarget] = useState<SubmissionRow | null>(null)
  const [failureReason, setFailureReason] = useState('')
  const [failureError, setFailureError] = useState('')
  const [failureSaving, setFailureSaving] = useState(false)

  const [voteRankSaving, setVoteRankSaving] = useState(false)
  const [voteRankError, setVoteRankError] = useState('')
  const [sortState, setSortState] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'time',
    direction: 'time',
  })
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [tableFilter, setTableFilter] = useState('ALL')
  const [provinceFilter, setProvinceFilter] = useState('ALL')
  const [facebookFilter, setFacebookFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [complaintStatusFilter, setComplaintStatusFilter] = useState('ALL')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [complaintTarget, setComplaintTarget] = useState<SubmissionRow | null>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importRankingSummaries, setImportRankingSummaries] = useState<ImportRankingSummary[] | null>(null)
  const [voteDetailTarget, setVoteDetailTarget] = useState<SubmissionRow | null>(null)
  const canAssignVoteRank = user?.role_code === 'TECH_ADMIN' || user?.role_code === 'TW_ADMIN'

  function cycleSort(key: Exclude<SortKey, 'time'>) {
    setSortState((current) => {
      if (current.key !== key) {
        return { key, direction: getDefaultSortDirection(key) }
      }

      const defaultDirection = getDefaultSortDirection(key)

      if (current.direction === defaultDirection) {
        return { key, direction: defaultDirection === 'asc' ? 'desc' : 'asc' }
      }

      if (current.direction !== 'time') {
        return { key, direction: 'time' }
      }

      return { key, direction: defaultDirection }
    })
  }

  function getSortIcon(key: Exclude<SortKey, 'time'>) {
    if (sortState.key !== key || sortState.direction === 'time') return '↕'
    return sortState.direction === 'desc' ? '↓' : '↑'
  }

  async function updateFailureStatus(id: number, isFailed: boolean, failedReason?: string) {
    const payload: { is_failed: boolean; failed_reason?: string } = {
      is_failed: isFailed,
    }

    if (isFailed) {
      payload.failed_reason = failedReason || ''
    }

    await api.patch(`/api/v1/submissions/${id}/failure-status`, payload)
  }

  async function handleFailureToggle(row: SubmissionRow) {
    try {
      if (row.is_failed === 0) {
        setFailureTarget(row)
        setFailureReason(row.failed_reason || '')
        setFailureError('')
        setFailureSaving(false)
        return
      }

      if (!window.confirm('Đánh dấu bài thi đạt yêu cầu?')) {
        return
      }

      setError('')
      setMessage('')
      await updateFailureStatus(row.id, false)
      await loadData()
      setMessage('Đã cập nhật trạng thái bài thi.')
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không cập nhật được trạng thái bài thi.'))
    }
  }

  function closeFailureDialog() {
    setFailureTarget(null)
    setFailureReason('')
    setFailureError('')
    setFailureSaving(false)
  }

  async function handleFailureSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!failureTarget) return

    const reason = failureReason.trim()
    if (!reason) {
      setFailureError('Vui lòng nhập lý do không đạt')
      return
    }

    setFailureSaving(true)
    setFailureError('')
    setError('')
    setMessage('')

    try {
      await updateFailureStatus(failureTarget.id, true, reason)
      closeFailureDialog()
      await loadData()
      setMessage('Đã cập nhật trạng thái bài thi và kích hoạt email lý do không đạt.')
    } catch (err: unknown) {
      setFailureError(normalizeError(err, 'Không cập nhật được trạng thái bài thi.'))
    } finally {
      setFailureSaving(false)
    }
  }

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [submissionRes, tableRes, resultRes, complaintRes] = await Promise.all([
        api.get('/api/v1/submissions'),
        api.get('/api/v1/competition_tables'),
        api.get('/api/v1/submission_results'),
        api.get('/api/v1/complaints'),
      ])
      setSubmissions((submissionRes.data?.data ?? []) as SubmissionRow[])
      setTables((tableRes.data?.data ?? []) as CompetitionTableRow[])
      setResults((resultRes.data?.data ?? []) as ResultRow[])
      const nextComplaintSummaries: Record<number, ComplaintSummary> = {}
      ;(complaintRes.data?.data ?? []).forEach((summary: ComplaintSummary) => {
        nextComplaintSummaries[summary.submission_id] = summary
      })
      setComplaintSummaries(nextComplaintSummaries)
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
      const facebookOk =
        facebookFilter === 'ALL' ||
        (facebookFilter === 'HAS' ? Boolean(row.fb_url?.trim()) : !row.fb_url?.trim())
      const statusOk =
        statusFilter === 'ALL' ||
        (statusFilter === 'PASS' ? row.is_failed === 0 : row.is_failed !== 0)
      const complaintStatus = complaintSummaries[row.id]?.complaint_status || 'NOT_STARTED'
      const complaintOk = complaintStatusFilter === 'ALL' || complaintStatus === complaintStatusFilter

      return tableOk && provinceOk && facebookOk && statusOk && complaintOk
    })

    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return filteredBySelections

    return filteredBySelections.filter((row) => {
      const tableName = tableNameById.get(row.competition_table_id || 0) || ''
      return [row.title, row.author_full_name, row.author_province_name, row.author_ward_name, tableName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    })
  }, [submissions, tableFilter, provinceFilter, facebookFilter, statusFilter, complaintStatusFilter, complaintSummaries, query, tableNameById])

  const displayedRows = useMemo(() => {
    if (sortState.direction === 'time' || sortState.key === 'time') return filteredRows
    const direction = sortState.direction as Exclude<SortDirection, 'time'>

    const sortedRows = [...filteredRows].sort((left, right) => {
      const leftResult = resultBySubmissionId.get(left.id)
      const rightResult = resultBySubmissionId.get(right.id)
      const leftTableName = tableNameById.get(left.competition_table_id || 0) || ''
      const rightTableName = tableNameById.get(right.competition_table_id || 0) || ''
      const leftAuthor = left.author_full_name || ''
      const rightAuthor = right.author_full_name || ''
      const leftTitle = left.title || ''
      const rightTitle = right.title || ''
      const leftFb = left.fb_url || ''
      const rightFb = right.fb_url || ''

      let result = 0

      switch (sortState.key) {
        case 'table':
          result = compareText(leftTableName, rightTableName, direction)
          break
        case 'author':
          result = compareText(leftAuthor, rightAuthor, direction)
          break
        case 'title':
          result = compareText(leftTitle, rightTitle, direction)
          break
        case 'submittedAt':
          result = compareDate(left.submitted_at, right.submitted_at, direction)
          break
        case 'facebook':
          result = compareLink(leftFb, rightFb, direction)
          break
        case 'vote':
          result = compareNumber(
            toNumber(leftResult?.vote_converted_points),
            toNumber(rightResult?.vote_converted_points),
            direction,
          )
          break
        case 'judge':
          result = compareNumber(
            toNumber(leftResult?.judge_total_points),
            toNumber(rightResult?.judge_total_points),
            direction,
          )
          break
        case 'total':
          result = compareNumber(
            toNumber(leftResult?.final_points),
            toNumber(rightResult?.final_points),
            direction,
          )
          break
        case 'status':
          result = compareNumber(left.is_failed, right.is_failed, direction)
          break
        default:
          result = 0
      }

      return result || right.id - left.id
    })

    return sortedRows
  }, [filteredRows, resultBySubmissionId, sortState.direction, sortState.key, tableNameById])

  const totalPages = Math.max(1, Math.ceil(displayedRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedRows = displayedRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    setPageInput(String(safePage))
  }, [safePage])

  function jumpToPage(rawValue: string) {
    const nextPage = Number(rawValue)
    if (!Number.isInteger(nextPage)) return
    setPage(Math.min(totalPages, Math.max(1, nextPage)))
  }

  function handlePageJumpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    jumpToPage(pageInput)
  }

  function renderPagination(position: 'top' | 'bottom') {
    const pageJumpId = `tw-page-jump-${position}`

    return (
      <div className="vb-tw-pagination">
        <button
          type="button"
          className="vb-tw-btn-muted"
          disabled={safePage <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Trang trước
        </button>
        <form className="vb-tw-pagination-jump" onSubmit={handlePageJumpSubmit}>
          <label htmlFor={pageJumpId} className="vb-sr-only">
            Đi đến trang
          </label>
          <input
            id={pageJumpId}
            className="vb-input"
            type="number"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={() => jumpToPage(pageInput)}
          />
          <span>/ {totalPages}</span>
        </form>
        <button
          type="button"
          className="vb-tw-btn-muted"
          disabled={safePage >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Trang sau
        </button>
      </div>
    )
  }

  useEffect(() => {
    setPage(1)
  }, [tableFilter, provinceFilter, facebookFilter, statusFilter, complaintStatusFilter, query, sortState.direction, sortState.key])

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

  function handleComplaintStatusChange(submissionId: number, status: ComplaintStatus) {
    setComplaintSummaries((current) => ({
      ...current,
      [submissionId]: {
        ...(current[submissionId] || {
          submission_id: submissionId,
          message_count: 0,
          last_message_at: null,
          last_sender_user_id: null,
          last_sender_full_name: null,
          last_sender_username: null,
          last_sender_role: null,
          last_sender_role_name: null,
        }),
        complaint_status: status,
      },
    }))
  }

  function openPublishDialog(submission: SubmissionRow) {
    setPublishTarget(submission)
    setPublishLink(submission.fb_url || '')
    setPublishError('')
    setPublishLoading(false)
  }

  function closePublishDialog() {
    setPublishTarget(null)
    setPublishLink('')
    setPublishError('')
    setPublishLoading(false)
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

  async function handleSendPublishNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!publishTarget) return

    setPublishError('')
    setMessage('')
    setPublishLoading(true)

    if (!publishLink.trim()) {
      setPublishError('Vui lòng nhập link bài Facebook.')
      setPublishLoading(false)
      return
    }

    try {
      await api.post(
        `/api/v1/submissions/${publishTarget.id}/notify-facebook`,
        {
          facebook_post_url: publishLink.trim(),
        },
      )
      setMessage('Đã lưu link Facebook và kích hoạt thông báo email cho thí sinh.')
      closePublishDialog()
      await loadData()
    } catch (err: unknown) {
      setPublishError(normalizeError(err, 'Không gửi được thông báo email.'))
    } finally {
      setPublishLoading(false)
    }
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
        { filter: buildExportFilter(tableFilter, provinceFilter, facebookFilter, statusFilter) },
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

  async function handleVoteImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImporting(true)
    setError('')
    setMessage('')
    setImportErrors([])
    setImportRankingSummaries(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await api.post('/api/v1/tw_admin/vote-import', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      setMessage(response.data?.message || 'Đã nhập dữ liệu bình chọn.')
      setImportRankingSummaries((response.data?.data?.ranking_summaries ?? []) as ImportRankingSummary[])
      await loadData()
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không nhập được file bình chọn.'))
      const data = (err as { response?: { data?: { errors?: Array<{ sheet?: string; row?: number; id?: unknown; message?: string }> } } })?.response?.data
      setImportErrors((data?.errors || []).map((item) => [item.sheet, item.row ? `dòng ${item.row}` : '', item.id != null ? `ID ${item.id}` : '', item.message || 'Lỗi'].filter(Boolean).join(' - ')))
    } finally {
      setImporting(false)
    }
  }

  return (
    <main className="vb-page vb-dashboard-page vb-tw-submissions-page">
      <Navbar />
      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Điều hành trung ương</p>
          <h1>Quản lý bài nộp</h1>
          <p className="vb-admin-lead">
            Lọc theo bảng thi, tỉnh/thành và tìm kiếm theo tiêu đề, người nộp, phường, bảng thi.
          </p>
        </div>
      </section>

      {error ? <section className="vb-account-banner is-error">{error}</section> : null}
      {importErrors.length > 0 ? <section className="vb-account-banner is-error">{importErrors.join(' | ')}</section> : null}
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

        {renderPagination('top')}

        <div className="vb-tw-toolbar-row vb-tw-submission-toolbar">
          <div className="vb-account-search">
            <label htmlFor="tw-submission-search">Tìm kiếm</label>
            <input
              id="tw-submission-search"
              className="vb-input"
              style={{ maxWidth: 260 }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tiêu đề, người nộp, tỉnh/thành, phường, bảng thi..."
            />
          </div>

          <div className="vb-account-filters" style={{ gridColumn: 'auto' }}>
            <div>
              <label htmlFor="tw-table-filter">Bảng thi</label>
              <select
                id="tw-table-filter"
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
              <label htmlFor="tw-province-filter">Tỉnh/Thành</label>
              <select
                id="tw-province-filter"
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
              <label htmlFor="tw-facebook-filter">Bài đăng Facebook</label>
              <select
                id="tw-facebook-filter"
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
              <label htmlFor="tw-status-filter">Đạt yêu cầu</label>
              <select
                id="tw-status-filter"
                className="vb-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Tất cả</option>
                <option value="PASS">Đạt yêu cầu</option>
                <option value="FAIL">Chưa đạt yêu cầu</option>
              </select>
            </div>
            <div>
              <label htmlFor="tw-complaint-status-filter">Trạng thái khiếu nại</label>
              <select
                id="tw-complaint-status-filter"
                className="vb-select"
                value={complaintStatusFilter}
                onChange={(e) => setComplaintStatusFilter(e.target.value)}
              >
                <option value="ALL">Tất cả</option>
                <option value="NOT_STARTED">Chưa khiếu nại</option>
                <option value="PENDING">Chưa xử lý</option>
                <option value="RESPONDED">Đã phản hồi</option>
              </select>
            </div>
          </div>

          <div className="vb-tw-toolbar-cta">
            <label className="vb-tw-btn-muted" style={{ cursor: importing ? 'wait' : 'pointer' }}>
              {importing ? 'Đang nhập...' : 'Nhập Excel bình chọn'}
              <input type="file" accept=".xlsx,.xls" hidden disabled={importing} onChange={(event) => void handleVoteImport(event)} />
            </label>
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
                <th>
                  <button type="button" className="vb-table-sort-button" onClick={() => cycleSort('table')}>
                    Bảng thi
                    <span>{getSortIcon('table')}</span>
                  </button>
                </th>
                <th>
                  <button type="button" className="vb-table-sort-button" onClick={() => cycleSort('author')}>
                    Người nộp
                    <span>{getSortIcon('author')}</span>
                  </button>
                </th>
                <th>
                  <button type="button" className="vb-table-sort-button" onClick={() => cycleSort('title')}>
                    Tiêu đề
                    <span>{getSortIcon('title')}</span>
                  </button>
                </th>
                <th>Bài thi</th>
                <th>
                  <button type="button" className="vb-table-sort-button" onClick={() => cycleSort('facebook')}>
                    Link Facebook
                    <span>{getSortIcon('facebook')}</span>
                  </button>
                </th>
                <th>
                  <button type="button" className="vb-table-sort-button" onClick={() => cycleSort('vote')}>
                    Điểm bình chọn
                    <span>{getSortIcon('vote')}</span>
                  </button>
                </th>
                <th>
                  <button type="button" className="vb-table-sort-button" onClick={() => cycleSort('judge')}>
                    Điểm bài thi
                    <span>{getSortIcon('judge')}</span>
                  </button>
                </th>
                <th>
                  <button type="button" className="vb-table-sort-button" onClick={() => cycleSort('total')}>
                    Tổng điểm
                    <span>{getSortIcon('total')}</span>
                  </button>
                </th>
                <th>
                  <button type="button" className="vb-table-sort-button" onClick={() => cycleSort('status')}>
                    Đạt yêu cầu
                    <span>{getSortIcon('status')}</span>
                  </button>
                </th>
                <th>Khiếu nại điểm</th>
                <th>
                  <button type="button" className="vb-table-sort-button" onClick={() => cycleSort('submittedAt')}>
                    Thời gian nộp
                    <span>{getSortIcon('submittedAt')}</span>
                  </button>
                </th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => {
                const result = resultBySubmissionId.get(row.id)
                const complaintStatus = complaintSummaries[row.id]?.complaint_status || 'NOT_STARTED'
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
                      <div className="vb-requirement-toggle">
                        <label className="vb-toggle">
                          <input
                            type="checkbox"
                            checked={row.is_failed === 0}
                            onChange={() => void handleFailureToggle(row)}
                          />
                          <span className="vb-toggle-slider" />
                        </label>
                      </div>
                    </td>
                    <td>
                      <span className={`vb-status-pill ${complaintStatusClass(complaintStatus)}`}>
                        {complaintStatusLabel(complaintStatus)}
                      </span>
                    </td>
                    <td>{formatSubmittedAt(row.submitted_at)}</td>
                    <td>
                      <div className="vb-tw-row-actions">
                        <button
                          type="button"
                          className="vb-tw-btn-muted"
                          onClick={() => setComplaintTarget(row)}
                        >
                          {complaintStatus === 'NOT_STARTED' ? 'Chưa có khiếu nại' : 'Phản hồi khiếu nại'}
                        </button>
                        {canAssignVoteRank ? (
                          <button
                            type="button"
                            className="vb-tw-btn-muted"
                            onClick={() => setVoteDetailTarget(row)}
                          >
                            Chi tiết bình chọn
                          </button>
                        ) : null}
                        {canAssignVoteRank ? (
                          <button
                            type="button"
                            className="vb-tw-btn-muted"
                            onClick={() => openVoteRankDialog(row)}
                            disabled={!row.fb_url}
                            title={!row.fb_url ? 'Bài thi chưa có Facebook URL' : undefined}
                          >
                            Chấm điểm
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="vb-tw-btn-primary"
                          onClick={() => openPublishDialog(row)}
                        >
                          Thông báo
                        </button>
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

        {publishTarget ? (
          <div className="vb-modal-backdrop" role="presentation" onClick={closePublishDialog}>
            <section
              className="vb-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="publish-notify-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="vb-modal-head">
                <p className="vb-overline">Gửi thông báo</p>
                <h2 id="publish-notify-title">Thông báo bài đăng Facebook</h2>
                <button type="button" className="vb-modal-close" onClick={closePublishDialog}>
                  Hủy
                </button>
              </div>
              <form className="vb-modal-body vb-modal-form" onSubmit={handleSendPublishNotification}>
                <p className="vb-modal-description">
                  Gửi email thông báo cho thí sinh <strong>{publishTarget.author_full_name || 'người dự thi'}</strong>.
                </p>
                <div className="vb-field">
                  <input
                    id="facebook_post_url"
                    className="vb-input"
                    placeholder=" "
                    value={publishLink}
                    onChange={(e) => setPublishLink(e.target.value)}
                    required
                  />
                  <label className="vb-float-label" htmlFor="facebook_post_url">Link bài Facebook</label>
                </div>
                {publishError ? <p className="vb-form-error">{publishError}</p> : null}
                <div className="vb-modal-actions">
                  <button type="button" className="vb-tw-btn-muted" onClick={closePublishDialog} disabled={publishLoading}>
                    Hủy
                  </button>
                  <button type="submit" className="vb-tw-btn-primary" disabled={publishLoading}>
                    {publishLoading ? 'Đang gửi...' : 'Gửi email'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}

        {complaintTarget ? (
          <ComplaintChatModal
            submissionId={complaintTarget.id}
            submissionTitle={complaintTarget.title}
            currentUserId={user?.id}
            currentUserRole={user?.role_code}
            onClose={() => setComplaintTarget(null)}
            onStatusChange={handleComplaintStatusChange}
          />
        ) : null}

        {voteDetailTarget ? (
          <div className="vb-modal-backdrop" role="presentation" onClick={() => setVoteDetailTarget(null)}>
            <section className="vb-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
              <div className="vb-modal-head">
                <div>
                  <p className="vb-overline">Chi tiết bình chọn</p>
                  <h2>{voteDetailTarget.title}</h2>
                </div>
                <button type="button" className="vb-modal-close" onClick={() => setVoteDetailTarget(null)}>Đóng</button>
              </div>
              <dl className="vb-lookup-mobile-grid">
                <div><dt>Lượt tương tác</dt><dd>{toNumber(voteDetailTarget.interaction_count)}</dd></div>
                <div><dt>Lượt share</dt><dd>{toNumber(voteDetailTarget.share_count)}</dd></div>
                <div><dt>Điểm tương tác</dt><dd>{toNumber(voteDetailTarget.engagement_score)}</dd></div>
                <div><dt>Thứ hạng</dt><dd>{voteDetailTarget.vote_rank_position ? (voteDetailTarget.vote_rank_position <= 5 ? `Top ${voteDetailTarget.vote_rank_position}` : `Hạng ${voteDetailTarget.vote_rank_position}`) : 'Chưa xếp hạng'}</dd></div>
                <div><dt>Điểm bình chọn</dt><dd>{toNumber(voteDetailTarget.vote_converted_points).toFixed(2)}</dd></div>
              </dl>
            </section>
          </div>
        ) : null}

        {importRankingSummaries ? (
          <div className="vb-modal-backdrop" role="presentation" onClick={() => setImportRankingSummaries(null)}>
            <section className="vb-modal" role="dialog" aria-modal="true" aria-labelledby="vote-import-result-title" onClick={(event) => event.stopPropagation()}>
              <div className="vb-modal-head">
                <div>
                  <p className="vb-overline">Kết quả nhập bình chọn</p>
                  <h2 id="vote-import-result-title">Top 5 sau khi tính lại</h2>
                  <p className="vb-modal-description">Mọi bài có Facebook URL đều đã được xếp hạng; Top 1–5 nhận lần lượt 50, 40, 30, 20, 10 điểm bình chọn.</p>
                </div>
                <button type="button" className="vb-modal-close" onClick={() => setImportRankingSummaries(null)}>Đóng</button>
              </div>
              <div className="vb-modal-body">
                {importRankingSummaries.length > 0 ? importRankingSummaries.map((summary) => (
                  <section key={summary.competition_table_id} className="vb-season-panel">
                    <div className="vb-modal-head">
                      <div>
                        <h3>{summary.competition_table_name}</h3>
                        <p className="vb-modal-description">{summary.ranked_count} bài có Facebook URL được xếp hạng</p>
                      </div>
                    </div>
                    {summary.top5.length > 0 ? (
                      <div className="vb-account-table-wrap">
                        <table className="vb-account-table">
                          <thead><tr><th>Hạng</th><th>Bài thi</th><th>Tác giả</th><th>Điểm tương tác</th><th>Điểm bình chọn</th></tr></thead>
                          <tbody>{summary.top5.map((row) => (
                            <tr key={row.submission_id}>
                              <td>Top {row.rank_position}</td>
                              <td>{row.title}</td>
                              <td>{row.author_full_name || 'N/A'}</td>
                              <td>{row.engagement_score}</td>
                              <td>{row.converted_points}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    ) : <p className="vb-modal-description">Chưa có bài thi nào có Facebook URL.</p>}
                  </section>
                )) : <p className="vb-modal-description">Không có bảng thi nào bị ảnh hưởng.</p>}
              </div>
            </section>
          </div>
        ) : null}

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

        {failureTarget ? (
          <div className="vb-modal-backdrop" role="presentation" onClick={closeFailureDialog}>
            <section
              className="vb-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="failure-status-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="vb-modal-head">
                <p className="vb-overline">Đánh giá bài thi</p>
                <h2 id="failure-status-title">Đánh dấu bài thi không đạt</h2>
                <button type="button" className="vb-modal-close" onClick={closeFailureDialog}>
                  Hủy
                </button>
              </div>
              <form className="vb-modal-body vb-modal-form" onSubmit={handleFailureSubmit}>
                <p className="vb-modal-description">
                  Nhập lý do không đạt cho <strong>{failureTarget.title || 'bài thi này'}</strong>. Lý do này sẽ được gửi email cho thí sinh sau khi lưu.
                </p>
                <div className="vb-field">
                  <textarea
                    id="failure_reason"
                    className="vb-input"
                    placeholder=" "
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    rows={4}
                  />
                  <label className="vb-float-label" htmlFor="failure_reason">
                    Lý do không đạt
                  </label>
                </div>
                {failureError ? <p className="vb-form-error">{failureError}</p> : null}
                <div className="vb-modal-actions">
                  <button
                    type="button"
                    className="vb-tw-btn-muted"
                    onClick={closeFailureDialog}
                    disabled={failureSaving}
                  >
                    Hủy
                  </button>
                  <button type="submit" className="vb-tw-btn-primary" disabled={failureSaving}>
                    {failureSaving ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}

        {renderPagination('bottom')}
      </section>
    </main>
  )
}
