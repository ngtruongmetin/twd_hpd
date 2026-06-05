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
}

type CompetitionTableRow = {
  id: number
  season_id: number
  code: string
  name: string
  description: string | null
  max_submissions_per_participant: number | string | null
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

// function statusLabel(status: string) {
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

function normalizeError(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) return err.response?.data?.message || fallback
  return fallback
}

export default function TwAdminCompetitions() {
  const [seasons, setSeasons] = useState<SeasonRow[]>([])
  const [tables, setTables] = useState<CompetitionTableRow[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [seasonForm, setSeasonForm] = useState<SeasonForm>(initialSeasonForm)
  const [loading, setLoading] = useState(true)
  const [savingSeason, setSavingSeason] = useState(false)
  const [savingTableId, setSavingTableId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [seasonRes, tableRes] = await Promise.all([api.get('/api/v1/seasons'), api.get('/api/v1/competition_tables')])
      const seasonRows = (seasonRes.data?.data ?? []) as SeasonRow[]
      setSeasons(seasonRows)
      setTables((tableRes.data?.data ?? []) as CompetitionTableRow[])
      if (seasonRows[0]) setSelectedSeasonId((id) => id ?? seasonRows[0].id)
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không tải được dữ liệu cuộc thi.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const selectedSeason = useMemo(() => seasons.find((item) => item.id === selectedSeasonId) || seasons[0] || null, [seasons, selectedSeasonId])
  const seasonTables = useMemo(() => tables.filter((item) => item.season_id === selectedSeason?.id).slice(0, 2), [tables, selectedSeason?.id])

  useEffect(() => {
    if (!selectedSeason) return
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
  }, [selectedSeason])

  async function handleSeasonSave(event: FormEvent) {
    event.preventDefault()
    if (!selectedSeason) return
    setSavingSeason(true)
    setMessage('')
    setError('')
    try {
      await api.put(`/api/v1/seasons/${selectedSeason.id}`, {
        ...seasonForm,
        submission_open_at: toIsoOrNull(seasonForm.submission_open_at),
        submission_close_at: toIsoOrNull(seasonForm.submission_close_at),
        voting_open_at: toIsoOrNull(seasonForm.voting_open_at),
        voting_close_at: toIsoOrNull(seasonForm.voting_close_at),
        top5_announce_at: toIsoOrNull(seasonForm.top5_announce_at),
        final_announce_at: toIsoOrNull(seasonForm.final_announce_at),
      })
      setMessage('Đã cập nhật cuộc thi.')
      await loadData()
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không cập nhật được cuộc thi.'))
    } finally {
      setSavingSeason(false)
    }
  }

  async function handleTableSave(table: CompetitionTableRow) {
    setSavingTableId(table.id)
    setMessage('')
    setError('')
    try {
      await api.put(`/api/v1/competition_tables/${table.id}`, {
        season_id: table.season_id,
        code: table.code,
        name: table.name,
        description: table.description,
        max_submissions_per_participant: Number(table.max_submissions_per_participant ?? 3),
      })
      setMessage(`Đã cập nhật ${table.name}.`)
      await loadData()
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không cập nhật được bảng thi.'))
    } finally {
      setSavingTableId(null)
    }
  }

  return (
    <main className="vb-page vb-dashboard-page vb-tw-competitions-page">
      <Navbar />
      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Điều hành trung ương</p>
          <h1>Quản lý cuộc thi</h1>
          <p className="vb-admin-lead">Chỉnh thông tin cuộc thi và thông tin hai bảng thi.</p>
        </div>
      </section>

      {error ? <section className="vb-account-banner is-error">{error}</section> : null}
      {message ? <section className="vb-account-banner">{message}</section> : null}
      {loading ? <section className="vb-account-banner">Đang tải dữ liệu...</section> : null}

      <section className="vb-season-layout">
        <aside className="vb-season-panel">
          <div className="vb-section-head is-compact"><div><p className="vb-overline">Cuộc thi</p><h2>Chọn cuộc thi</h2></div></div>
          <div className="vb-season-list">
            {seasons.map((season) => (
              <button key={season.id} type="button" className={`vb-season-item ${selectedSeason?.id === season.id ? 'is-active' : ''}`} onClick={() => setSelectedSeasonId(season.id)}>
                <strong>{season.name}</strong><span>{season.code}</span><small>{currentSubmissionStateLabel(season)}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="vb-season-panel">
          <div className="vb-section-head is-compact"><div><p className="vb-overline">Thông tin cuộc thi</p><h2>Chỉnh sửa</h2></div></div>
          <form className="vb-season-form" onSubmit={handleSeasonSave}>
            <div className="vb-form-grid">
              <div className="vb-field">
                <input
                  type="datetime-local"
                  className="vb-input"
                  placeholder=" "
                  value={seasonForm.submission_open_at}
                  onChange={(e) => setSeasonForm((p) => ({ ...p, submission_open_at: e.target.value }))}
                />
                <label className="vb-float-label">Mở nộp bài</label>
              </div>
              <div className="vb-field">
                <input
                  type="datetime-local"
                  className="vb-input"
                  placeholder=" "
                  value={seasonForm.submission_close_at}
                  onChange={(e) => setSeasonForm((p) => ({ ...p, submission_close_at: e.target.value }))}
                />
                <label className="vb-float-label">Đóng nộp bài</label>
              </div>
            </div>
            <div className="vb-modal-actions">
              <button type="submit" className="vb-tw-btn-primary" disabled={savingSeason || !selectedSeason}>{savingSeason ? 'Đang lưu...' : 'Lưu cuộc thi'}</button>
            </div>
          </form>
        </section>
      </section>

      <section className="vb-season-panel">
        <div className="vb-section-head is-compact"><div><p className="vb-overline">Bảng thi</p><h2>Chỉnh thông tin hai bảng thi</h2></div></div>
        <div className="vb-season-table">
          {seasonTables.map((table) => (
            <article key={table.id} className="vb-season-table-item">
              <strong>{table.name}</strong>
              <div className="vb-field">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={table.name}
                  onChange={(e) => setTables((rows) => rows.map((row) => (row.id === table.id ? { ...row, name: e.target.value } : row)))}
                />
                <label className="vb-float-label">Tên bảng thi</label>
              </div>
              <div className="vb-field">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={table.description || ''}
                  onChange={(e) => setTables((rows) => rows.map((row) => (row.id === table.id ? { ...row, description: e.target.value } : row)))}
                />
                <label className="vb-float-label">Mô tả bảng thi</label>
              </div>
              <div className="vb-field">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={String(table.max_submissions_per_participant ?? 3)}
                  onChange={(e) => setTables((rows) => rows.map((row) => (row.id === table.id ? { ...row, max_submissions_per_participant: e.target.value } : row)))}
                />
                <label className="vb-float-label">Số bài tối đa</label>
              </div>
              <button type="button" className="vb-tw-btn-primary" onClick={() => void handleTableSave(table)} disabled={savingTableId === table.id}>{savingTableId === table.id ? 'Đang lưu...' : 'Lưu bảng thi'}</button>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
