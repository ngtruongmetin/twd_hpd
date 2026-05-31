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

const initialCompetitionForm: CompetitionForm = {
  code: '',
  name: '',
  description: '',
  max_submissions_per_participant: '3',
  max_video_seconds: '',
  min_video_quality: '',
  required_aspect_ratio: '',
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

function emptySeasonForm(): SeasonForm {
  return { ...initialSeasonForm }
}

function emptyCompetitionForm(): CompetitionForm {
  return { ...initialCompetitionForm }
}

export default function TechAdminSeasons() {
  const [seasons, setSeasons] = useState<SeasonRow[]>([])
  const [competitionTables, setCompetitionTables] = useState<CompetitionTableRow[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [seasonForm, setSeasonForm] = useState<SeasonForm>(emptySeasonForm())
  const [competitionForm, setCompetitionForm] = useState<CompetitionForm>(emptyCompetitionForm())
  const [editingSeasonId, setEditingSeasonId] = useState<number | null>(null)
  const [editingCompetitionId, setEditingCompetitionId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingSeason, setSavingSeason] = useState(false)
  const [savingCompetition, setSavingCompetition] = useState(false)
  const [error, setError] = useState('')
  const [seasonMessage, setSeasonMessage] = useState('')
  const [competitionMessage, setCompetitionMessage] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [seasonResponse, competitionResponse] = await Promise.all([
        api.get('/api/v1/seasons'),
        api.get('/api/v1/competition_tables'),
      ])

      const seasonRows = (seasonResponse.data?.data ?? []) as SeasonRow[]
      const competitionRows = (competitionResponse.data?.data ?? []) as CompetitionTableRow[]

      setSeasons(seasonRows)
      setCompetitionTables(competitionRows)

      const firstSeason = seasonRows[0] || null
      if (firstSeason) {
        setSelectedSeasonId((current) => current ?? firstSeason.id)
      }
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message || 'Không tải được dữ liệu cuộc thi.'
        : 'Không tải được dữ liệu cuộc thi.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const selectedSeason = useMemo(
    () => seasons.find((season) => season.id === selectedSeasonId) || seasons[0] || null,
    [selectedSeasonId, seasons],
  )

  const filteredCompetitionTables = useMemo(
    () => competitionTables.filter((item) => item.season_id === selectedSeason?.id),
    [competitionTables, selectedSeason],
  )

  useEffect(() => {
    if (!selectedSeason) {
      setSeasonForm(emptySeasonForm())
      setCompetitionForm(emptyCompetitionForm())
      setEditingSeasonId(null)
      setEditingCompetitionId(null)
      return
    }

    setSeasonForm({
      code: selectedSeason.code || '',
      name: selectedSeason.name || '',
      description: selectedSeason.description || '',
      submission_open_at: formatForInput(selectedSeason.submission_open_at),
      submission_close_at: formatForInput(selectedSeason.submission_close_at),
      voting_open_at: formatForInput(selectedSeason.voting_open_at),
      voting_close_at: formatForInput(selectedSeason.voting_close_at),
      top5_announce_at: formatForInput(selectedSeason.top5_announce_at),
      final_announce_at: formatForInput(selectedSeason.final_announce_at),
      status: (selectedSeason.status as SeasonStatus) || 'DRAFT',
    })
    setEditingSeasonId(selectedSeason.id)
  }, [selectedSeason])

  function pickSeason(season: SeasonRow) {
    setSelectedSeasonId(season.id)
    setCompetitionMessage('')
    setSeasonMessage('')
  }

  function startNewSeason() {
    setSelectedSeasonId(null)
    setSeasonForm(emptySeasonForm())
    setEditingSeasonId(null)
    setCompetitionForm(emptyCompetitionForm())
    setEditingCompetitionId(null)
    setSeasonMessage('')
    setCompetitionMessage('')
  }

  function startNewCompetition() {
    setCompetitionForm(emptyCompetitionForm())
    setEditingCompetitionId(null)
    setCompetitionMessage('')
  }

  function editCompetition(table: CompetitionTableRow) {
    setCompetitionForm({
      code: table.code || '',
      name: table.name || '',
      description: table.description || '',
      max_submissions_per_participant: String(table.max_submissions_per_participant ?? '3'),
      max_video_seconds: table.max_video_seconds == null ? '' : String(table.max_video_seconds),
      min_video_quality: table.min_video_quality || '',
      required_aspect_ratio: table.required_aspect_ratio || '',
    })
    setEditingCompetitionId(table.id)
  }

  async function handleSeasonSave(event: FormEvent) {
    event.preventDefault()
    setSavingSeason(true)
    setSeasonMessage('')
    setCompetitionMessage('')

    const payload = {
      ...seasonForm,
      submission_open_at: toIsoOrNull(seasonForm.submission_open_at),
      submission_close_at: toIsoOrNull(seasonForm.submission_close_at),
      voting_open_at: toIsoOrNull(seasonForm.voting_open_at),
      voting_close_at: toIsoOrNull(seasonForm.voting_close_at),
      top5_announce_at: toIsoOrNull(seasonForm.top5_announce_at),
      final_announce_at: toIsoOrNull(seasonForm.final_announce_at),
    }

    try {
      if (editingSeasonId) {
        await api.put(`/api/v1/seasons/${editingSeasonId}`, payload)
        setSeasonMessage('Đã cập nhật cuộc thi.')
      } else {
        const response = await api.post('/api/v1/seasons', payload)
        const createdId = response.data?.data?.id
        if (createdId) {
          setSelectedSeasonId(createdId)
        }
        setSeasonMessage('Đã tạo cuộc thi mới.')
      }
      await loadData()
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message || 'Không lưu được cuộc thi.'
        : 'Không lưu được cuộc thi.'
      setSeasonMessage(message)
    } finally {
      setSavingSeason(false)
    }
  }

  async function handleCompetitionSave(event: FormEvent) {
    event.preventDefault()
    if (!selectedSeason) {
      setCompetitionMessage('Hãy chọn một cuộc thi trước.')
      return
    }

    setSavingCompetition(true)
    setCompetitionMessage('')

    const payload = {
      season_id: selectedSeason.id,
      code: competitionForm.code,
      name: competitionForm.name,
      description: competitionForm.description || null,
      max_submissions_per_participant: Number(competitionForm.max_submissions_per_participant || 3),
      max_video_seconds: competitionForm.max_video_seconds ? Number(competitionForm.max_video_seconds) : null,
      min_video_quality: competitionForm.min_video_quality || null,
      required_aspect_ratio: competitionForm.required_aspect_ratio || null,
    }

    try {
      if (editingCompetitionId) {
        await api.put(`/api/v1/competition_tables/${editingCompetitionId}`, payload)
        setCompetitionMessage('Đã cập nhật bảng thi.')
      } else {
        await api.post('/api/v1/competition_tables', payload)
        setCompetitionMessage('Đã tạo bảng thi mới.')
      }
      await loadData()
      setEditingCompetitionId(null)
      setCompetitionForm(emptyCompetitionForm())
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message || 'Không lưu được bảng thi.'
        : 'Không lưu được bảng thi.'
      setCompetitionMessage(message)
    } finally {
      setSavingCompetition(false)
    }
  }

  return (
    <main className="vb-page vb-dashboard-page vb-seasons-page">
      <Navbar />

      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Cuộc thi & cấu hình</p>
          <h1>Thiết lập timeline, bảng thi và mốc công bố</h1>
          <p className="vb-admin-lead">
            Quản lý các cuộc thi, khung thời gian vận hành và danh mục bảng thi cho TECH_ADMIN.
          </p>
        </div>

        <aside className="vb-admin-session">
          <p className="vb-overline">Tổng quan</p>
          <h2>{seasons.length} cuộc thi</h2>
          <dl className="vb-session-list">
            <div>
              <dt>Đang chọn</dt>
              <dd>{selectedSeason?.name || 'Chưa chọn cuộc thi'}</dd>
            </div>
            <div>
              <dt>Bảng thi</dt>
              <dd>{filteredCompetitionTables.length}</dd>
            </div>
          </dl>
        </aside>
      </section>

      {error ? <section className="vb-account-banner is-error">{error}</section> : null}
      {loading ? <section className="vb-account-banner">Đang tải cuộc thi...</section> : null}

      <section className="vb-season-layout">
        <aside className="vb-season-panel">
          <div className="vb-section-head is-compact">
            <div>
              <p className="vb-overline">Danh sách cuộc thi</p>
              <h2>Chọn cuộc thi cần cấu hình</h2>
            </div>
            <button type="button" className="vb-btn vb-btn-secondary" onClick={startNewSeason}>
              Tạo cuộc thi mới
            </button>
          </div>

          <div className="vb-season-list">
            {seasons.map((season) => (
              <button
                type="button"
                key={season.id}
                className={`vb-season-item ${selectedSeason?.id === season.id ? 'is-active' : ''}`}
                onClick={() => pickSeason(season)}
              >
                <strong>{season.name}</strong>
                <span>{season.code}</span>
                <small>{season.status}</small>
                <small>{formatDate(season.created_at)}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="vb-season-panel">
          <div className="vb-section-head is-compact">
            <div>
              <p className="vb-overline">Cấu hình cuộc thi</p>
              <h2>Timeline và mốc công bố</h2>
            </div>
            <p className="vb-section-note">{editingSeasonId ? `Đang sửa #${editingSeasonId}` : 'Tạo cuộc thi mới'}</p>
          </div>

          <form className="vb-season-form" onSubmit={handleSeasonSave}>
            <div className="vb-form-grid">
              <div className="vb-field">
                <input className="vb-input" placeholder=" " value={seasonForm.code} onChange={(e) => setSeasonForm((prev) => ({ ...prev, code: e.target.value }))} required />
                <label className="vb-float-label">Mã cuộc thi</label>
              </div>
              <div className="vb-field">
                <input className="vb-input" placeholder=" " value={seasonForm.name} onChange={(e) => setSeasonForm((prev) => ({ ...prev, name: e.target.value }))} required />
                <label className="vb-float-label">Tên cuộc thi</label>
              </div>
              <div className="vb-field vb-full">
                <input className="vb-input" placeholder=" " value={seasonForm.description} onChange={(e) => setSeasonForm((prev) => ({ ...prev, description: e.target.value }))} />
                <label className="vb-float-label">Mô tả</label>
              </div>
              <div className="vb-field">
                <label className="vb-label">Trạng thái</label>
                <select className="vb-select" value={seasonForm.status} onChange={(e) => setSeasonForm((prev) => ({ ...prev, status: e.target.value as SeasonStatus }))}>
                  {seasonStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
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
                      onChange={(e) => setSeasonForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                    <label className="vb-float-label">{label}</label>
                  </div>
                ))}
              </div>
            </div>

            {seasonMessage ? <p className="vb-form-success">{seasonMessage}</p> : null}

            <div className="vb-modal-actions">
              <button type="submit" className="vb-btn vb-btn-primary" disabled={savingSeason}>
                {savingSeason ? 'Đang lưu...' : 'Lưu cuộc thi'}
              </button>
              <button type="button" className="vb-btn vb-btn-secondary" onClick={startNewSeason}>
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
            <h2>Thiết lập bảng thi theo cuộc thi</h2>
          </div>
          <button type="button" className="vb-btn vb-btn-secondary" onClick={startNewCompetition} disabled={!selectedSeason}>
            Tạo bảng thi
          </button>
        </div>

        <div className="vb-season-grid">
          <form className="vb-season-form" onSubmit={handleCompetitionSave}>
            <div className="vb-form-grid">
              <div className="vb-field">
                <input className="vb-input" placeholder=" " value={competitionForm.code} onChange={(e) => setCompetitionForm((prev) => ({ ...prev, code: e.target.value }))} required disabled={!selectedSeason} />
                <label className="vb-float-label">Mã bảng thi</label>
              </div>
              <div className="vb-field">
                <input className="vb-input" placeholder=" " value={competitionForm.name} onChange={(e) => setCompetitionForm((prev) => ({ ...prev, name: e.target.value }))} required disabled={!selectedSeason} />
                <label className="vb-float-label">Tên bảng thi</label>
              </div>
              <div className="vb-field vb-full">
                <input className="vb-input" placeholder=" " value={competitionForm.description} onChange={(e) => setCompetitionForm((prev) => ({ ...prev, description: e.target.value }))} disabled={!selectedSeason} />
                <label className="vb-float-label">Mô tả</label>
              </div>
              <div className="vb-field">
                <input className="vb-input" placeholder=" " value={competitionForm.max_submissions_per_participant} onChange={(e) => setCompetitionForm((prev) => ({ ...prev, max_submissions_per_participant: e.target.value }))} disabled={!selectedSeason} />
                <label className="vb-float-label">Số bài tối đa</label>
              </div>
              <div className="vb-field">
                <input className="vb-input" placeholder=" " value={competitionForm.max_video_seconds} onChange={(e) => setCompetitionForm((prev) => ({ ...prev, max_video_seconds: e.target.value }))} disabled={!selectedSeason} />
                <label className="vb-float-label">Giới hạn video (giây)</label>
              </div>
              <div className="vb-field">
                <input className="vb-input" placeholder=" " value={competitionForm.min_video_quality} onChange={(e) => setCompetitionForm((prev) => ({ ...prev, min_video_quality: e.target.value }))} disabled={!selectedSeason} />
                <label className="vb-float-label">Chất lượng tối thiểu</label>
              </div>
              <div className="vb-field">
                <input className="vb-input" placeholder=" " value={competitionForm.required_aspect_ratio} onChange={(e) => setCompetitionForm((prev) => ({ ...prev, required_aspect_ratio: e.target.value }))} disabled={!selectedSeason} />
                <label className="vb-float-label">Tỷ lệ khung hình</label>
              </div>
            </div>

            {competitionMessage ? <p className="vb-form-success">{competitionMessage}</p> : null}

            <div className="vb-modal-actions">
              <button type="submit" className="vb-btn vb-btn-primary" disabled={!selectedSeason || savingCompetition}>
                {savingCompetition ? 'Đang lưu...' : 'Lưu bảng thi'}
              </button>
              <button type="button" className="vb-btn vb-btn-secondary" onClick={startNewCompetition} disabled={!selectedSeason}>
                Làm mới
              </button>
            </div>
          </form>

          <article className="vb-season-table-card">
            <p className="vb-overline">Danh sách bảng thi</p>
            <h3>{selectedSeason ? selectedSeason.name : 'Chưa chọn cuộc thi'}</h3>
            <div className="vb-season-table">
              {filteredCompetitionTables.map((table) => (
                <div key={table.id} className="vb-season-table-item">
                  <div>
                    <strong>{table.name}</strong>
                    <span>{table.code}</span>
                  </div>
                  <p>{table.description || 'Không có mô tả'}</p>
                  <small>
                    {table.max_submissions_per_participant || 0} bài/người · {table.max_video_seconds || '—'} giây · {table.min_video_quality || '—'}
                  </small>
                  <small>{formatDate(table.created_at)}</small>
                  <button type="button" className="vb-table-link" onClick={() => editCompetition(table)}>
                    Chỉnh sửa
                  </button>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}
