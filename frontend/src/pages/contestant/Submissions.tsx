import axios from 'axios'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { api } from '../../api/api'
import { getDashboardTitleForRole } from '../../auth/role'
import { useAuth } from '../../context/useAuth'

type SeasonRow = {
    id: number
    code: string
    name: string
    status: string
    submission_open_at: string | null
    submission_close_at: string | null
    final_announce_at: string | null
}

type CompetitionTableRow = {
    id: number
    season_id: number
    code: string
    name: string
    description: string | null
    max_submissions_per_participant: number | string | null
}

type SubmissionRow = {
    id: number
    competition_table_id?: number | null
    title: string
    submitted_by_user_id?: number | null
    description: string | null
    video_url: string | null
    fb_url?: string | null
    author_full_name: string | null
    author_province_name: string | null
    author_ward_name: string | null
    author_school_name: string | null
    other_members: string | null
    drive_file_id: string | null
    drive_is_public: number | null
    is_failed?: number | null
    failed_reason?: string | null
    submitted_at?: string | null
    created_at: string | null
    updated_at?: string | null
}

type SubmissionForm = {
    seasonId: string
    competitionTableId: string
    title: string
    summary: string
    driveUrl: string
    otherMembers: string
}

type DriveValidation = {
    valid: boolean
    message: string
    fileId?: string | null
    public?: boolean
}

const initialForm: SubmissionForm = {
    seasonId: '',
    competitionTableId: '',
    title: '',
    summary: '',
    driveUrl: '',
    otherMembers: '',
}

function formatDate(value: string | null) {
    if (!value) return 'N/A'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date)
}

function getStatusLabel(row: SubmissionRow) {
    if (row.is_failed === 1) return 'Không đạt'
    if (row.updated_at && row.submitted_at && row.updated_at !== row.submitted_at) {
        return 'Đạt yêu cầu'
    }
    return 'Đang kiểm duyệt'
}

function getStatusTone(status: string) {
    if (status === 'Không đạt') return 'failed'
    if (status === 'Đạt yêu cầu') return 'approved'
    return 'reviewing'
}

function getStatusClass(status: string) {
    const tone = getStatusTone(status)
    if (tone === 'failed') return 'is-failed'
    if (tone === 'approved') return 'is-active'
    return 'is-pending'
}

function normalizeSubmissionError(message: string) {
    if (
        message.includes('SQLITE_CONSTRAINT') ||
        message.includes('Maximum 3 submissions per team per competition table exceeded')
    ) {
        return 'Mỗi đội chỉ được nộp tối đa 3 bài cho mỗi bảng thi.'
    }

    return message
}

function sameUser(submission: SubmissionRow, userId?: number) {
    return Boolean(submission.submitted_by_user_id && userId && submission.submitted_by_user_id === userId)
}

function isGoogleDriveUrl(value?: string | null) {
    if (!value) return false

    try {
        const url = new URL(value)
        return /(^|\.)google\.com$/i.test(url.hostname) || /(^|\.)googleusercontent\.com$/i.test(url.hostname)
    } catch {
        return false
    }
}

function isSeasonAcceptingSubmissions(season?: SeasonRow | null) {
    if (!season) return false

    const openAt = season.submission_open_at ? new Date(season.submission_open_at).getTime() : null
    const closeAt = season.submission_close_at ? new Date(season.submission_close_at).getTime() : null

    if (!openAt && !closeAt) {
        return false
    }

    const now = Date.now()
    if (openAt && now < openAt) return false
    if (closeAt && now > closeAt) return false

    return true
}

export default function ContestantSubmissions() {
    const { user } = useAuth()
    const title = getDashboardTitleForRole(user?.role_code)
    const displayName = user?.full_name || user?.username || 'CONTESTANT'

    const [seasons, setSeasons] = useState<SeasonRow[]>([])
    const [competitionTables, setCompetitionTables] = useState<CompetitionTableRow[]>([])
    const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
    const [form, setForm] = useState<SubmissionForm>(initialForm)
    const [driveValidation, setDriveValidation] = useState<DriveValidation | null>(null)
    const [driveChecking, setDriveChecking] = useState(false)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const successTimerRef = useRef<number | null>(null)

    const selectedSeason = useMemo(
        () => seasons.find((season) => String(season.id) === form.seasonId) || seasons[0] || null,
        [form.seasonId, seasons],
    )

    const availableCompetitionTables = useMemo(
        () => competitionTables.filter((item) => !selectedSeason || item.season_id === selectedSeason.id),
        [competitionTables, selectedSeason],
    )

    const selectedCompetitionTable = useMemo(
        () => availableCompetitionTables.find((item) => String(item.id) === form.competitionTableId) || null,
        [availableCompetitionTables, form.competitionTableId],
    )

    const seasonAcceptingSubmissions = isSeasonAcceptingSubmissions(selectedSeason)

    const profileReady =
        !!user?.full_name &&
        !!user?.province_name &&
        !!user?.ward_name &&
        !!user?.email &&
        !!user?.phone &&
        !!selectedSeason &&
        seasonAcceptingSubmissions &&
        !!selectedCompetitionTable &&
        !!form.title.trim() &&
        !!form.summary.trim() &&
        !!driveValidation?.valid

    async function loadData() {
        setLoading(true)
        setError('')

        try {
            const [seasonResponse, competitionResponse, submissionResponse] = await Promise.all([
                api.get('/api/v1/seasons'),
                api.get('/api/v1/competition_tables'),
                api.get('/api/v1/submissions'),
            ])

            const seasonRows = (seasonResponse.data?.data ?? []) as SeasonRow[]
            const competitionRows = (competitionResponse.data?.data ?? []) as CompetitionTableRow[]
            const submissionRows = (submissionResponse.data?.data ?? []) as SubmissionRow[]

            setSeasons(seasonRows)
            setCompetitionTables(competitionRows)
            setSubmissions(submissionRows)

            const defaultSeason = seasonRows[0] || null
            const defaultCompetition = defaultSeason
                ? competitionRows.find((item) => item.season_id === defaultSeason.id) || null
                : null

            setForm((current) => ({
                ...current,
                seasonId: current.seasonId || (defaultSeason ? String(defaultSeason.id) : ''),
                competitionTableId: current.competitionTableId || (defaultCompetition ? String(defaultCompetition.id) : ''),
            }))
        } catch (err: unknown) {
            const message = axios.isAxiosError(err)
                ? err.response?.data?.message || 'Không tải được dữ liệu nộp bài.'
                : 'Không tải được dữ liệu nộp bài.'
            setError(normalizeSubmissionError(message))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadData()
    }, [])

    useEffect(() => {
        return () => {
            if (successTimerRef.current) {
                window.clearTimeout(successTimerRef.current)
            }
        }
    }, [])

    useEffect(() => {
        if (!form.driveUrl.trim()) {
            setDriveValidation(null)
            setDriveChecking(false)
            return
        }

        if (!isGoogleDriveUrl(form.driveUrl.trim())) {
            setDriveValidation({
                valid: false,
                message: 'Link Google Drive bài thi không hợp lệ.',
            })
            setDriveChecking(false)
            return
        }

        const timer = window.setTimeout(() => {
            setDriveChecking(true)
            void (async () => {
                try {
                    const response = await api.post('/api/v1/submissions/validate-drive', {
                        url: form.driveUrl.trim(),
                    })

                    setDriveValidation({
                        valid: true,
                        message: response.data?.message || 'Link Google Drive bài thi hợp lệ.',
                        fileId: response.data?.data?.file_id || null,
                        public: response.data?.data?.public,
                    })
                } catch (err: unknown) {
                    const message = axios.isAxiosError(err)
                        ? err.response?.data?.message || 'Link Google Drive bài thi không hợp lệ.'
                        : 'Link Google Drive bài thi không hợp lệ.'

                    setDriveValidation({
                        valid: false,
                        message,
                    })
                } finally {
                    setDriveChecking(false)
                }
            })()
        }, 500)

        return () => window.clearTimeout(timer)
    }, [form.driveUrl])

    useEffect(() => {
        if (!selectedSeason) return

        if (availableCompetitionTables.length === 0) {
            setForm((current) => ({
                ...current,
                competitionTableId: '',
            }))
            return
        }

        const selected = availableCompetitionTables.find((item) => String(item.id) === form.competitionTableId)
        if (!selected) {
            setForm((current) => ({
                ...current,
                competitionTableId: String(availableCompetitionTables[0].id),
            }))
        }
    }, [availableCompetitionTables, form.competitionTableId, selectedSeason])

    const mySubmissions = useMemo(
        () => submissions.filter((submission) => sameUser(submission, user?.id)),
        [submissions, user?.id],
    )
    const competitionTableById = useMemo(
        () =>
            new Map(
                competitionTables.map((table) => [
                    table.id,
                    table.name || table.description || table.code || `Bảng thi #${table.id}`,
                ]),
            ),
        [competitionTables],
    )

    async function handleSubmit(event: FormEvent) {
        event.preventDefault()

        if (!profileReady) {
            if (!seasonAcceptingSubmissions) {
                setError('Cuộc thi này đã đóng nộp bài.')
                return
            }

            setError('Bạn cần bổ sung email, số điện thoại, tỉnh/thành, phường/xã và link Google Drive bài thi hợp lệ trước khi nộp bài.')
            return
        }

        if (!driveValidation?.valid) {
            setError(driveValidation?.message || 'Link Google Drive bài thi không hợp lệ.')
            return
        }

        setSaving(true)
        setError('')
        setSuccess('')

        try {
            await api.post('/api/v1/submissions', {
                season_id: Number(form.seasonId),
                competition_table_id: Number(form.competitionTableId),
                title: form.title,
                description: form.summary,
                video_url: form.driveUrl,
                other_members: form.otherMembers || null,
            })

            setSuccess('Đã gửi bài thành công. Hệ thống sẽ gửi email xác nhận tới email của bạn.')
            if (successTimerRef.current) {
                window.clearTimeout(successTimerRef.current)
            }
            successTimerRef.current = window.setTimeout(() => {
                setSuccess('')
            }, 2500)
            setForm((current) => ({ ...initialForm, seasonId: current.seasonId, competitionTableId: current.competitionTableId }))
            setDriveValidation(null)
            await loadData()
        } catch (err: unknown) {
            const message = axios.isAxiosError(err)
                ? err.response?.data?.message || 'Không gửi được bài.'
                : 'Không gửi được bài.'
            setError(normalizeSubmissionError(message))
        } finally {
            setSaving(false)
        }
    }


    async function handleDeleteSubmission(submissionId: number) {
        const confirmed = window.confirm('Bạn có chắc muốn xóa bài nộp này không?')
        if (!confirmed) return

        setDeletingId(submissionId)
        setError('')
        setSuccess('')

        try {
            await api.delete(`/api/v1/submissions/${submissionId}`)
            setSuccess('Đã xóa bài nộp.')
            await loadData()
        } catch (err: unknown) {
            const message = axios.isAxiosError(err)
                ? err.response?.data?.message || 'Không xóa được bài nộp.'
                : 'Không xóa được bài nộp.'
            setError(normalizeSubmissionError(message))
        } finally {
            setDeletingId(null)
        }
    }
    return (
        <main className="vb-page vb-dashboard-page vb-contestant-page">
            <Navbar />

            <section className="vb-admin-hero vb-card vb-card-editorial">
                <div className="vb-admin-hero-copy">
                    <p className="vb-overline">Nộp bài dự thi</p>
                    <h1>{title}</h1>
                    <p className="vb-admin-lead">
                        Trang này dùng để gửi bài và xem bài của bạn.
                    </p>
                    <div className="vb-chip-row">
                        <span className="vb-chip">{displayName}</span>
                        <Link className="vb-chip vb-chip-active" to="/dashboard/contestant">
                            Quay về hồ sơ
                        </Link>
                    </div>
                </div>

                <aside className="vb-admin-session">
                    <p className="vb-overline">Cuộc thi</p>
                    <h2>{selectedSeason?.name || 'Chưa có cuộc thi'}</h2>
                    <dl className="vb-session-list">
                        <div>
                            <dt>Hạn nộp</dt>
                            <dd>{formatDate(selectedSeason?.submission_close_at || null)}</dd>
                        </div>
                        <div>
                            <dt>Công bố cuối</dt>
                            <dd>{formatDate(selectedSeason?.final_announce_at || null)}</dd>
                        </div>
                        <div>
                            <dt>Bài của tôi</dt>
                            <dd>{mySubmissions.length}</dd>
                        </div>
                    </dl>
                </aside>
            </section>

            {loading ? <section className="vb-account-banner">Đang tải trang nộp bài...</section> : null}

            <section className="vb-contestant-grid">
                <article className="vb-contestant-panel vb-contestant-submit">
                    <div className="vb-section-head is-compact">
                        <div>
                            <p className="vb-overline">Biểu mẫu</p>
                            <h2>Gửi bài dự thi</h2>
                        </div>
                    </div>

                    <form className="vb-contestant-form" onSubmit={handleSubmit}>
                        <div className="vb-submit-meta">
                            <div className="vb-field">
                                <label className="vb-label" htmlFor="seasonName">
                                    Cuộc thi
                                </label>
                                <input
                                    id="seasonName"
                                    className="vb-input"
                                    value={selectedSeason?.name || ''}
                                    disabled
                                    readOnly
                                />
                            </div>

                            <div className="vb-field">
                                <label className="vb-label" htmlFor="competitionTableId">
                                    Bảng thi <span className="vb-required">*</span>
                                </label>
                                <select
                                    id="competitionTableId"
                                    className="vb-select"
                                    value={form.competitionTableId}
                                    onChange={(e) => setForm((prev) => ({ ...prev, competitionTableId: e.target.value }))}
                                    disabled={!selectedSeason}
                                >
                                    <option value="">Chọn bảng thi</option>
                                    {availableCompetitionTables.map((table) => (
                                        <option key={table.id} value={table.id}>
                                            {table.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="vb-form-grid">
                            <div className="vb-field">
                                <input className="vb-input" placeholder=" " value={user?.full_name || ''} disabled readOnly />
                                <label className="vb-float-label">Họ và tên</label>
                            </div>
                            <div className="vb-field">
                                <input className="vb-input" placeholder=" " value={user?.email || ''} disabled readOnly />
                                <label className="vb-float-label">Email</label>
                            </div>
                            <div className="vb-field">
                                <input className="vb-input" placeholder=" " value={user?.province_name || ''} disabled readOnly />
                                <label className="vb-float-label">Tỉnh thành</label>
                            </div>
                            <div className="vb-field">
                                <input className="vb-input" placeholder=" " value={user?.ward_name || ''} disabled readOnly />
                                <label className="vb-float-label">Phường / Xã</label>
                            </div>

                            <div className="vb-field vb-full vb-form-section-break">
                                <input
                                    id="title"
                                    className="vb-input"
                                    placeholder=" "
                                    value={form.title}
                                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                                    required
                                />
                                <label className="vb-float-label" htmlFor="title">
                                    Tiêu đề bài thi <span className="vb-required">*</span>
                                </label>
                            </div>

                            <div className="vb-field vb-full">
                                <textarea
                                    id="summary"
                                    className="vb-input vb-textarea"
                                    placeholder=" "
                                    value={form.summary}
                                    onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
                                    rows={5}
                                    required
                                />
                                <label className="vb-float-label" htmlFor="summary">
                                    Mô tả ngắn <span className="vb-required">*</span>
                                </label>
                            </div>

                            <div className="vb-field vb-full">
                                <input
                                    id="otherMembers"
                                    className="vb-input"
                                    placeholder=" "
                                    value={form.otherMembers}
                                    onChange={(e) => setForm((prev) => ({ ...prev, otherMembers: e.target.value }))}
                                />
                                <label className="vb-float-label" htmlFor="otherMembers">
                                    Thành viên khác (không bắt buộc)
                                </label>
                            </div>

                            <div className="vb-field vb-full">
                                <input
                                    id="driveUrl"
                                    className="vb-input"
                                    placeholder=" "
                                    value={form.driveUrl}
                                    onChange={(e) => setForm((prev) => ({ ...prev, driveUrl: e.target.value }))}
                                />
                                <label className="vb-float-label" htmlFor="driveUrl">
                                    Link Google Drive bài thi <span className="vb-required">*</span>
                                </label>
                                {driveChecking ? <p className="vb-auth-helper">Đang kiểm tra Link Google Drive bài thi...</p> : null}
                                {driveValidation?.message ? (
                                    <p className={driveValidation.valid ? 'vb-form-success' : 'vb-form-error'}>{driveValidation.message}</p>
                                ) : null}
                            </div>


                        </div>

                        <div className="vb-modal-actions">
                            <button type="submit" className="vb-btn vb-btn-primary" disabled={saving || !profileReady || driveChecking}>
                                {saving ? 'Đang gửi...' : 'Gửi bài dự thi'}
                            </button>
                            <button
                                type="button"
                                className="vb-btn vb-btn-secondary"
                                onClick={() => setForm((current) => ({ ...initialForm, seasonId: current.seasonId, competitionTableId: current.competitionTableId }))}
                            >
                                Làm mới
                            </button>
                        </div>

                        {error ? <p className="vb-form-error vb-form-submit-error">{error}</p> : null}

                        {!seasonAcceptingSubmissions ? (
                            <p className="vb-form-error vb-form-submit-error">Cuộc thi này đã đóng nộp bài.</p>
                        ) : null}


                        {success ? <p className="vb-form-success vb-form-submit-success">{success}</p> : null}
                    </form>
                </article>

                <aside className="vb-contestant-aside">
                    <article className="vb-contestant-panel">
                        <div className="vb-section-head is-compact">
                            <div>
                                <p className="vb-overline">Bài của tôi</p>
                                <h3>Danh sách bài đã nộp</h3>
                            </div>
                            <p className="vb-section-note">{mySubmissions.length} bài nộp</p>
                        </div>

                        <div className="vb-contestant-table-wrap">
                            <table className="vb-contestant-table">
                                <thead>
                                    <tr>
                                        <th>Bảng thi</th>
                                        <th>Tiêu đề</th>
                                        <th>Mô tả</th>
                                        <th>Link bài thi</th>
                                        <th>Bài đăng Facebook</th>
                                        <th>Trạng thái</th>
                                        <th>Thời gian nộp</th>
                                        <th>Hành động</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mySubmissions.length > 0 ? (
                                        mySubmissions.map((submission) => {
                                            const statusLabel = getStatusLabel(submission)

                                            return (
                                                <tr key={submission.id}>
                                                    <td>
                                                        {submission.competition_table_id
                                                            ? competitionTableById.get(submission.competition_table_id) || `Bảng thi #${submission.competition_table_id}`
                                                            : 'Bảng thi'}
                                                    </td>
                                                    <td>{submission.title}</td>
                                                    <td>{submission.description || 'Không có mô tả'}</td>
                                                    <td>
                                                        {submission.video_url ? (
                                                            <a className="vb-tw-btn-link" href={submission.video_url} target="_blank" rel="noreferrer">
                                                                Xem bài thi
                                                            </a>
                                                        ) : (
                                                            'Không có'
                                                        )}
                                                    </td>
                                                    <td>
                                                        {submission.fb_url ? (
                                                            <a className="vb-tw-btn-link" href={submission.fb_url} target="_blank" rel="noreferrer">
                                                                Xem bài đăng Facebook
                                                            </a>
                                                        ) : (
                                                            'Đang chờ đăng tải'
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className={`vb-status-pill ${getStatusClass(statusLabel)}`}>
                                                            {statusLabel}
                                                        </span>
                                                    </td>
                                                    <td>{formatDate(submission.submitted_at || submission.created_at)}</td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="vb-tw-btn-danger"
                                                            onClick={() => void handleDeleteSubmission(submission.id)}
                                                        >
                                                            {deletingId === submission.id ? 'Đang xóa...' : 'Xóa'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="vb-contestant-empty">
                                                Chưa có bài nào của bạn.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </article>
                </aside>
            </section>
        </main>
    )
}
