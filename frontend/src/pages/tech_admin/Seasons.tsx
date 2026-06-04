import axios from 'axios'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Navbar from '../../components/Navbar'
import { api } from '../../api/api'

type SeasonRow = {
  id: number
  code: string
  name: string
  description: string | null
  submission_open_at: string | null
  submission_close_at: string | null
  voting_open_at: string | null
  voting_close_at: string | null
  top5_announce_at: string | null
  final_announce_at: string | null
  status: string
  created_at: string | null
}

type CompetitionTableRow = {
  id: number
  season_id: number
  code: string
  name: string
  description: string | null
  max_submissions_per_participant: number | string | null
  max_video_seconds: number | string | null
  min_video_quality: string | null
  required_aspect_ratio: string | null
  created_at: string | null
}

type SeasonStatus = 'DRAFT' | 'OPEN_SUBMISSION' | 'CLOSED_SUBMISSION' | 'JUDGING' | 'ANNOUNCED' | 'ARCHIVED'

type SeasonForm = {
  code: string
  name: string
  description: string
  submission_open_at: string
  submission_close_at: string
  voting_open_at: string
  voting_close_at: string
  top5_announce_at: string
  final_announce_at: string
  status: SeasonStatus
}

type CompetitionForm = {
  season_id: string
  code: string
  name: string
  description: string
  max_submissions_per_participant: string
  max_video_seconds: string
  min_video_quality: string
  required_aspect_ratio: string
}

const seasonStatusOptions: { label: string; value: SeasonStatus }[] = [
  { label: 'Bản nháp', value: 'DRAFT' },
  { label: 'Mở nộp bài', value: 'OPEN_SUBMISSION' },
  { label: 'Đóng nộp bài', value: 'CLOSED_SUBMISSION' },
  { label: 'Đang chấm', value: 'JUDGING' },
  { label: 'Đã công bố', value: 'ANNOUNCED' },
  { label: 'Lưu trữ', value: 'ARCHIVED' },
]

const initialSeasonForm: SeasonForm = {
  code: '',
  name: '',
  description: '',
  submission_open_at: '',
  submission_close_at: '',
  voting_open_at: '',
  voting_close_at: '',
  top5_announce_at: '',
  final_announce_at: '',
  status: 'DRAFT',
}

function emptySeasonForm(): SeasonForm {
  return { ...initialSeasonForm }
}

function emptyCompetitionForm(seasonId: number | null): CompetitionForm {
  return {
    season_id: seasonId ? String(seasonId) : '',
    code: '',
    name: '',
    description: '',
    max_submissions_per_participant: '3',
    max_video_seconds: '',
    min_video_quality: '',
    required_aspect_ratio: '',
  }
}

function formatForInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

function toIsoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null
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

// function seasonStatusLabel(status: string) {
//   return seasonStatusOptions.find((item) => item.value === status)?.label || status
// }

function isSubmissionOpenNow(season?: SeasonRow | null) {
  if (!season) return false

  const openAt = season.submission_open_at ? new Date(season.submission_open_at).getTime() : null
  const closeAt = season.submission_close_at ? new Date(season.submission_close_at).getTime() : null
  if (!openAt && !closeAt) return false

  const now = Date.now()
  if (openAt && now < openAt) return false
  if (closeAt && now > closeAt) return false
  return true
}

function currentSubmissionStateLabel(season?: SeasonRow | null) {
  return isSubmissionOpenNow(season) ? 'Đang mở nộp bài' : 'Đang đóng nộp bài'
}

function normalizeError(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) return err.response?.data?.message || fallback
  return fallback
}

function buildSeasonForm(season: SeasonRow): SeasonForm {
  return {
    code: season.code || '',
    name: season.name || '',
    description: season.description || '',
    submission_open_at: formatForInput(season.submission_open_at),
    submission_close_at: formatForInput(season.submission_close_at),
    voting_open_at: formatForInput(season.voting_open_at),
    voting_close_at: formatForInput(season.voting_close_at),
    top5_announce_at: formatForInput(season.top5_announce_at),
    final_announce_at: formatForInput(season.final_announce_at),
    status: (season.status as SeasonStatus) || 'DRAFT',
  }
}

function buildCompetitionForm(table: CompetitionTableRow): CompetitionForm {
  return {
    season_id: String(table.season_id || ''),
    code: table.code || '',
    name: table.name || '',
    description: table.description || '',
    max_submissions_per_participant: String(table.max_submissions_per_participant ?? '3'),
    max_video_seconds: table.max_video_seconds == null ? '' : String(table.max_video_seconds),
    min_video_quality: table.min_video_quality || '',
    required_aspect_ratio: table.required_aspect_ratio || '',
  }
}

export default function TechAdminSeasons() {
  const [seasons, setSeasons] = useState<SeasonRow[]>([])
  const [tables, setTables] = useState<CompetitionTableRow[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [seasonForm, setSeasonForm] = useState<SeasonForm>(emptySeasonForm())
  const [competitionForm, setCompetitionForm] = useState<CompetitionForm>(emptyCompetitionForm(null))
  const [editingSeasonId, setEditingSeasonId] = useState<number | null>(null)
  const [editingTableId, setEditingTableId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingSeason, setSavingSeason] = useState(false)
  const [savingTable, setSavingTable] = useState(false)
  const [deletingSeasonId, setDeletingSeasonId] = useState<number | null>(null)
  const [deletingTableId, setDeletingTableId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [seasonMessage, setSeasonMessage] = useState('')
  const [tableMessage, setTableMessage] = useState('')

  const selectedSeason = useMemo(
    () => seasons.find((season) => season.id === selectedSeasonId) || null,
    [seasons, selectedSeasonId],
  )

  const selectedSeasonTables = useMemo(
    () => tables.filter((table) => table.season_id === selectedSeason?.id),
    [selectedSeason?.id, tables],
  )

  const stats = useMemo(() => {
    const activeCount = seasons.filter((season) => isSubmissionOpenNow(season)).length
    const draftCount = seasons.filter((season) => season.status === 'DRAFT').length
    return {
      seasons: seasons.length,
      tables: tables.length,
      active: activeCount,
      draft: draftCount,
    }
  }, [seasons, tables])

  async function loadData(preferredSeasonId?: number | null) {
    setLoading(true)
    setError('')
    try {
      const [seasonResponse, tableResponse] = await Promise.all([
        api.get('/api/v1/seasons'),
        api.get('/api/v1/competition_tables'),
      ])

      const seasonRows = (seasonResponse.data?.data ?? []) as SeasonRow[]
      const tableRows = (tableResponse.data?.data ?? []) as CompetitionTableRow[]

      setSeasons(seasonRows)
      setTables(tableRows)

      if (seasonRows.length === 0) {
        setSelectedSeasonId(null)
        if (!editingSeasonId) {
          setSeasonForm(emptySeasonForm())
        }
        if (!editingTableId) {
          setCompetitionForm(emptyCompetitionForm(null))
        }
        return
      }

      const currentSeasonId = preferredSeasonId ?? selectedSeasonId ?? null
      const currentSeason = seasonRows.find((season) => season.id === currentSeasonId) || seasonRows[0]

      if (!currentSeasonId || currentSeason.id !== currentSeasonId) {
        setSelectedSeasonId(currentSeason.id)
        if (!editingSeasonId) {
          setSeasonForm(buildSeasonForm(currentSeason))
          setEditingSeasonId(currentSeason.id)
        }
        if (!editingTableId) {
          setCompetitionForm((current) => ({
            ...current,
            season_id: String(currentSeason.id),
          }))
        }
      }
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không tải được dữ liệu cuộc thi.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectSeason(season: SeasonRow) {
    setSelectedSeasonId(season.id)
    setEditingSeasonId(season.id)
    setSeasonForm(buildSeasonForm(season))
    setSeasonMessage('')
    setTableMessage('')
    if (!editingTableId) {
      setCompetitionForm((current) => ({
        ...current,
        season_id: String(season.id),
      }))
    }
  }

  function startNewSeason() {
    setEditingSeasonId(null)
    setSeasonForm(emptySeasonForm())
    setSeasonMessage('')
    setTableMessage('')
  }

  function openTableEditor(table: CompetitionTableRow) {
    const targetSeason = seasons.find((season) => season.id === table.season_id) || null
    if (targetSeason) {
      setSelectedSeasonId(targetSeason.id)
      setEditingSeasonId(targetSeason.id)
      setSeasonForm(buildSeasonForm(targetSeason))
    }
    setEditingTableId(table.id)
    setCompetitionForm(buildCompetitionForm(table))
    setSeasonMessage('')
    setTableMessage('')
  }

  function startNewTable() {
    const seasonId = selectedSeason?.id ?? seasons[0]?.id ?? null
    if (seasonId && selectedSeason?.id !== seasonId) {
      const season = seasons.find((item) => item.id === seasonId)
      if (season) {
        setSelectedSeasonId(season.id)
        setEditingSeasonId(season.id)
        setSeasonForm(buildSeasonForm(season))
      }
    }
    setEditingTableId(null)
    setCompetitionForm(emptyCompetitionForm(seasonId))
    setSeasonMessage('')
    setTableMessage('')
  }

  async function handleSeasonSave(event: FormEvent) {
    event.preventDefault()

    const payload = {
      ...seasonForm,
      submission_open_at: toIsoOrNull(seasonForm.submission_open_at),
      submission_close_at: toIsoOrNull(seasonForm.submission_close_at),
      voting_open_at: toIsoOrNull(seasonForm.voting_open_at),
      voting_close_at: toIsoOrNull(seasonForm.voting_close_at),
      top5_announce_at: toIsoOrNull(seasonForm.top5_announce_at),
      final_announce_at: toIsoOrNull(seasonForm.final_announce_at),
    }

    setSavingSeason(true)
    setError('')
    setSeasonMessage('')

    try {
      let nextSeasonId: number | null = editingSeasonId
      if (editingSeasonId) {
        await api.put(`/api/v1/seasons/${editingSeasonId}`, payload)
        setSeasonMessage('Đã cập nhật mùa thi.')
      } else {
        const response = await api.post('/api/v1/seasons', payload)
        const createdId = response.data?.data?.id
        if (createdId) {
          nextSeasonId = createdId
          setSelectedSeasonId(createdId)
          setEditingSeasonId(createdId)
          setCompetitionForm((current) => ({
            ...current,
            season_id: String(createdId),
          }))
        }
        setSeasonMessage('Đã tạo mùa thi mới.')
      }

      await loadData(nextSeasonId)
    } catch (err: unknown) {
      setSeasonMessage(normalizeError(err, 'Không lưu được mùa thi.'))
    } finally {
      setSavingSeason(false)
    }
  }

  async function handleSeasonDelete(seasonId: number) {
    const season = seasons.find((item) => item.id === seasonId)
    if (!season) return
    if (!window.confirm(`Xóa mùa thi "${season.name}"?`)) return

    setDeletingSeasonId(seasonId)
    setError('')
    setSeasonMessage('')

    try {
      await api.delete(`/api/v1/seasons/${seasonId}`)
      const remainingSeasons = seasons.filter((item) => item.id !== seasonId)
      const nextSeason = remainingSeasons[0] || null

      setSelectedSeasonId(nextSeason?.id ?? null)
      if (nextSeason) {
        setEditingSeasonId(nextSeason.id)
        setSeasonForm(buildSeasonForm(nextSeason))
        setCompetitionForm((current) => ({
          ...current,
          season_id: String(nextSeason.id),
        }))
      } else {
        setEditingSeasonId(null)
        setSeasonForm(emptySeasonForm())
        setCompetitionForm(emptyCompetitionForm(null))
      }

      setSeasonMessage('Đã xóa mùa thi.')
      await loadData(nextSeason?.id ?? null)
    } catch (err: unknown) {
      setSeasonMessage(normalizeError(err, 'Không xóa được mùa thi.'))
    } finally {
      setDeletingSeasonId(null)
    }
  }

  async function handleTableSave(event: FormEvent) {
    event.preventDefault()

    const seasonId = Number(competitionForm.season_id)
    if (!seasonId) {
      setTableMessage('Vui lòng chọn mùa thi cho bảng thi.')
      return
    }

    const payload = {
      season_id: seasonId,
      code: competitionForm.code.trim(),
      name: competitionForm.name.trim(),
      description: competitionForm.description.trim() || null,
      max_submissions_per_participant: competitionForm.max_submissions_per_participant
        ? Number(competitionForm.max_submissions_per_participant)
        : null,
      max_video_seconds: competitionForm.max_video_seconds ? Number(competitionForm.max_video_seconds) : null,
      min_video_quality: competitionForm.min_video_quality.trim() || null,
      required_aspect_ratio: competitionForm.required_aspect_ratio.trim() || null,
    }

    setSavingTable(true)
    setError('')
    setTableMessage('')

    try {
      if (editingTableId) {
        await api.put(`/api/v1/competition_tables/${editingTableId}`, payload)
        setTableMessage('Đã cập nhật bảng thi.')
      } else {
        await api.post('/api/v1/competition_tables', payload)
        setTableMessage('Đã tạo bảng thi mới.')
      }

      setEditingTableId(null)
      setCompetitionForm(emptyCompetitionForm(seasonId))
      setSelectedSeasonId(seasonId)
      await loadData(seasonId)
    } catch (err: unknown) {
      setTableMessage(normalizeError(err, 'Không lưu được bảng thi.'))
    } finally {
      setSavingTable(false)
    }
  }

  async function handleTableDelete(tableId: number) {
    const table = tables.find((item) => item.id === tableId)
    if (!table) return
    if (!window.confirm(`Xóa bảng thi "${table.name}"?`)) return

    setDeletingTableId(tableId)
    setError('')
    setTableMessage('')

    try {
      await api.delete(`/api/v1/competition_tables/${tableId}`)
      if (editingTableId === tableId) {
        setEditingTableId(null)
        setCompetitionForm(emptyCompetitionForm(selectedSeason?.id ?? table.season_id))
      }
      setTableMessage('Đã xóa bảng thi.')
      await loadData(table.season_id)
    } catch (err: unknown) {
      setTableMessage(normalizeError(err, 'Không xóa được bảng thi.'))
    } finally {
      setDeletingTableId(null)
    }
  }

  return (
    <main className="vb-page vb-dashboard-page vb-seasons-page">
      <Navbar />

      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Điều hành kỹ thuật</p>
          <h1>CRUD mùa thi và bảng thi trên web</h1>
          <p className="vb-admin-lead">
            Tất cả tinh chỉnh vận hành cốt lõi đều có thể làm trực tiếp trên giao diện này, không cần SSH hay sửa tay trên server.
          </p>
        </div>

        <aside className="vb-admin-session">
          <p className="vb-overline">Tổng quan</p>
          <h2>{stats.seasons} mùa thi</h2>
          <dl className="vb-session-list">
            <div>
              <dt>Tổng bảng thi</dt>
              <dd>{stats.tables}</dd>
            </div>
            <div>
              <dt>Đang mở nộp</dt>
              <dd>{stats.active}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="vb-tw-stats-grid vb-tw-stats-grid-2">
        <article className="vb-season-panel">
          <p className="vb-overline">Mùa nháp</p>
          <strong className="vb-province-kpi-value">{stats.draft}</strong>
          <span className="vb-province-kpi-label">Số mùa thi đang ở trạng thái bản nháp</span>
        </article>
        <article className="vb-season-panel">
          <p className="vb-overline">Mùa hiện chọn</p>
          <strong className="vb-province-kpi-value">{selectedSeason?.name || 'Chưa chọn'}</strong>
          <span className="vb-province-kpi-label">
            {selectedSeason ? `${selectedSeason.code} · ${currentSubmissionStateLabel(selectedSeason)}` : 'Chọn mùa thi ở panel bên trái'}
          </span>
        </article>
      </section>

      {error ? <section className="vb-account-banner is-error">{error}</section> : null}
      {loading ? <section className="vb-account-banner">Đang tải dữ liệu...</section> : null}

      <section className="vb-season-layout">
        <aside className="vb-season-panel">
          <div className="vb-section-head is-compact">
            <div>
              <p className="vb-overline">Mùa thi</p>
              <h2>Danh sách và thao tác</h2>
            </div>
            <button type="button" className="vb-tw-btn-primary" onClick={startNewSeason}>
              Tạo mùa thi
            </button>
          </div>

          <div className="vb-season-list">
            {seasons.map((season) => (
              <article
                key={season.id}
                className={`vb-season-item ${selectedSeason?.id === season.id ? 'is-active' : ''}`}
              >
                <strong>{season.name}</strong>
                <span>{season.code}</span>
                <small>{currentSubmissionStateLabel(season)}</small>
                <small>{formatDate(season.created_at)}</small>

                <div className="vb-tw-action-row" style={{ marginTop: 12 }}>
                  <button type="button" className="vb-tw-btn-muted" onClick={() => selectSeason(season)}>
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="vb-tw-btn-danger"
                    onClick={() => void handleSeasonDelete(season.id)}
                    disabled={deletingSeasonId === season.id}
                  >
                    {deletingSeasonId === season.id ? 'Đang xóa...' : 'Xóa'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <section className="vb-season-panel">
          <div className="vb-section-head is-compact">
            <div>
              <p className="vb-overline">Biểu mẫu mùa thi</p>
              <h2>{editingSeasonId ? 'Chỉnh sửa mùa thi' : 'Tạo mùa thi mới'}</h2>
            </div>
            <p className="vb-section-note">
              {editingSeasonId ? `Đang sửa #${editingSeasonId}` : 'Lưu sẽ tạo record mới'}
            </p>
          </div>

          <form className="vb-season-form" onSubmit={handleSeasonSave}>
            <div className="vb-form-grid">
              <div className="vb-field">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={seasonForm.code}
                  onChange={(e) => setSeasonForm((prev) => ({ ...prev, code: e.target.value }))}
                  required
                />
                <label className="vb-float-label">Mã mùa thi</label>
              </div>
              <div className="vb-field">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={seasonForm.name}
                  onChange={(e) => setSeasonForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
                <label className="vb-float-label">Tên mùa thi</label>
              </div>
              <div className="vb-field vb-full">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={seasonForm.description}
                  onChange={(e) => setSeasonForm((prev) => ({ ...prev, description: e.target.value }))}
                />
                <label className="vb-float-label">Mô tả</label>
              </div>
              <div className="vb-field">
                <label className="vb-label">Trạng thái</label>
                <select
                  className="vb-select"
                  value={seasonForm.status}
                  onChange={(e) => setSeasonForm((prev) => ({ ...prev, status: e.target.value as SeasonStatus }))}
                >
                  {seasonStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="vb-season-timeline">
              <div className="vb-season-timeline-head">
                <p className="vb-overline">Timeline</p>
                <h3>Các mốc vận hành</h3>
              </div>

              <div className="vb-form-grid">
                {[
                  ['submission_open_at', 'Mở nộp bài'],
                  ['submission_close_at', 'Đóng nộp bài'],
                  ['voting_open_at', 'Mở bình chọn'],
                  ['voting_close_at', 'Đóng bình chọn'],
                  ['top5_announce_at', 'Công bố top 5'],
                  ['final_announce_at', 'Công bố chung cuộc'],
                ].map(([key, label]) => (
                  <div className="vb-field" key={key}>
                    <input
                      type="datetime-local"
                      className="vb-input"
                      placeholder=" "
                      value={seasonForm[key as keyof SeasonForm]}
                      onChange={(e) =>
                        setSeasonForm((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                    />
                    <label className="vb-float-label">{label}</label>
                  </div>
                ))}
              </div>
            </div>

            {seasonMessage ? <p className="vb-form-success">{seasonMessage}</p> : null}

            <div className="vb-modal-actions">
              <button type="submit" className="vb-tw-btn-primary" disabled={savingSeason}>
                {savingSeason ? 'Đang lưu...' : 'Lưu mùa thi'}
              </button>
              <button type="button" className="vb-tw-btn-muted" onClick={startNewSeason}>
                Làm mới
              </button>
            </div>
          </form>
        </section>
      </section>

      <section className="vb-season-panel">
        <div className="vb-section-head is-compact">
          <div>
            <p className="vb-overline">Bảng thi</p>
            <h2>Bảng thi của mùa đang chọn</h2>
          </div>
          <div className="vb-tw-action-row">
            <button type="button" className="vb-tw-btn-primary" onClick={startNewTable} disabled={!selectedSeason}>
              Tạo bảng thi
            </button>
          </div>
        </div>

        <div className="vb-season-grid">
          <form className="vb-season-form" onSubmit={handleTableSave}>
            <div className="vb-form-grid">
              <div className="vb-field">
                <label className="vb-label">Mùa thi</label>
                <select
                  className="vb-select"
                  value={competitionForm.season_id}
                  onChange={(e) => setCompetitionForm((prev) => ({ ...prev, season_id: e.target.value }))}
                  required
                >
                  <option value="">Chọn mùa thi</option>
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="vb-field">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={competitionForm.code}
                  onChange={(e) => setCompetitionForm((prev) => ({ ...prev, code: e.target.value }))}
                  required
                />
                <label className="vb-float-label">Mã bảng thi</label>
              </div>
              <div className="vb-field">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={competitionForm.name}
                  onChange={(e) => setCompetitionForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
                <label className="vb-float-label">Tên bảng thi</label>
              </div>
              <div className="vb-field vb-full">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={competitionForm.description}
                  onChange={(e) => setCompetitionForm((prev) => ({ ...prev, description: e.target.value }))}
                />
                <label className="vb-float-label">Mô tả</label>
              </div>
              <div className="vb-field">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={competitionForm.max_submissions_per_participant}
                  onChange={(e) =>
                    setCompetitionForm((prev) => ({
                      ...prev,
                      max_submissions_per_participant: e.target.value,
                    }))
                  }
                />
                <label className="vb-float-label">Số bài tối đa</label>
              </div>
              <div className="vb-field">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={competitionForm.max_video_seconds}
                  onChange={(e) =>
                    setCompetitionForm((prev) => ({
                      ...prev,
                      max_video_seconds: e.target.value,
                    }))
                  }
                />
                <label className="vb-float-label">Giới hạn video (giây)</label>
              </div>
              <div className="vb-field">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={competitionForm.min_video_quality}
                  onChange={(e) =>
                    setCompetitionForm((prev) => ({
                      ...prev,
                      min_video_quality: e.target.value,
                    }))
                  }
                />
                <label className="vb-float-label">Chất lượng tối thiểu</label>
              </div>
              <div className="vb-field">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={competitionForm.required_aspect_ratio}
                  onChange={(e) =>
                    setCompetitionForm((prev) => ({
                      ...prev,
                      required_aspect_ratio: e.target.value,
                    }))
                  }
                />
                <label className="vb-float-label">Tỷ lệ khung hình</label>
              </div>
            </div>

            {tableMessage ? <p className="vb-form-success">{tableMessage}</p> : null}

            <div className="vb-modal-actions">
              <button type="submit" className="vb-tw-btn-primary" disabled={savingTable}>
                {savingTable ? 'Đang lưu...' : editingTableId ? 'Cập nhật bảng thi' : 'Lưu bảng thi'}
              </button>
              <button type="button" className="vb-tw-btn-muted" onClick={startNewTable} disabled={!selectedSeason}>
                Làm mới
              </button>
            </div>
          </form>

          <article className="vb-season-table-card">
            <p className="vb-overline">Danh sách bảng thi</p>
            <h3>{selectedSeason ? selectedSeason.name : 'Chưa chọn mùa thi'}</h3>
            <div className="vb-season-table">
              {selectedSeasonTables.map((table) => (
                <article key={table.id} className="vb-season-table-item">
                  <strong>{table.name}</strong>
                  <span>{table.code}</span>
                  <p>{table.description || 'Không có mô tả'}</p>
                  <small>
                    {table.max_submissions_per_participant || 0} bài/người ·{' '}
                    {table.max_video_seconds || '—'} giây · {table.min_video_quality || '—'}
                  </small>
                  <small>{formatDate(table.created_at)}</small>

                  <div className="vb-tw-action-row" style={{ marginTop: 12 }}>
                    <button type="button" className="vb-tw-btn-muted" onClick={() => openTableEditor(table)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="vb-tw-btn-danger"
                      onClick={() => void handleTableDelete(table.id)}
                      disabled={deletingTableId === table.id}
                    >
                      {deletingTableId === table.id ? 'Đang xóa...' : 'Xóa'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}
