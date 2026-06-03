import axios from 'axios'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Navbar from '../../components/Navbar'
import { api } from '../../api/api'

type EmailLogRow = {
  id: number
  user_id: number | null
  email: string | null
  template_code: string | null
  subject: string | null
  status: string | null
  sent_at: string | null
  error_message: string | null
  created_at?: string | null
  updated_at?: string | null
}

type ExportTarget = 'ALL' | 'TECH_ADMIN' | 'TW_ADMIN' | 'PROVINCE_ADMIN' | 'JUDGE' | 'CONTESTANT'

type MailForm = {
  to_email: string
  subject: string
  content: string
  html: string
}

const exportTargetOptions: Array<{ label: string; value: ExportTarget }> = [
  { label: 'Tất cả tài khoản', value: 'ALL' },
  { label: 'Quản trị kỹ thuật', value: 'TECH_ADMIN' },
  { label: 'Quản trị trung ương', value: 'TW_ADMIN' },
  { label: 'Quản trị tỉnh/thành', value: 'PROVINCE_ADMIN' },
  { label: 'Giám khảo', value: 'JUDGE' },
  { label: 'Thí sinh', value: 'CONTESTANT' },
]

const logStatusOptions = ['ALL', 'SENT', 'FAILED'] as const

function normalizeError(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) return err.response?.data?.message || fallback
  return fallback
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function buildExportFilter(target: ExportTarget) {
  if (target === 'ALL') return []

  const roleIdByTarget: Record<Exclude<ExportTarget, 'ALL'>, number> = {
    TECH_ADMIN: 1,
    TW_ADMIN: 2,
    PROVINCE_ADMIN: 3,
    JUDGE: 5,
    CONTESTANT: 4,
  }

  return [{ key: 'role_id', value: roleIdByTarget[target] }]
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

function getExportFileName(target: ExportTarget) {
  const suffix = target === 'ALL' ? 'all' : target.toLowerCase()
  return `users-${suffix}.xlsx`
}

export default function TechAdminOperations() {
  const [mailForm, setMailForm] = useState<MailForm>({
    to_email: '',
    subject: '',
    content: '',
    html: '',
  })
  const [sendingMail, setSendingMail] = useState(false)
  const [mailError, setMailError] = useState('')
  const [mailMessage, setMailMessage] = useState('')

  const [exportTarget, setExportTarget] = useState<ExportTarget>('ALL')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [exportMessage, setExportMessage] = useState('')

  const [logs, setLogs] = useState<EmailLogRow[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsError, setLogsError] = useState('')
  const [logSearch, setLogSearch] = useState('')
  const [logStatusFilter, setLogStatusFilter] = useState<(typeof logStatusOptions)[number]>('ALL')

  async function loadLogs() {
    setLogsLoading(true)
    setLogsError('')
    try {
      const response = await api.get('/api/v1/email_logs')
      setLogs((response.data?.data ?? []) as EmailLogRow[])
    } catch (err: unknown) {
      setLogsError(normalizeError(err, 'Không tải được nhật ký email.'))
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    void loadLogs()
  }, [])

  const filteredLogs = useMemo(() => {
    const normalized = logSearch.trim().toLowerCase()

    return logs.filter((log) => {
      const statusOk = logStatusFilter === 'ALL' || (log.status || '').toUpperCase() === logStatusFilter
      const queryOk =
        !normalized ||
        [log.email, log.template_code, log.subject, log.error_message]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized))

      return statusOk && queryOk
    })
  }, [logSearch, logStatusFilter, logs])

  const stats = useMemo(() => {
    const sent = logs.filter((log) => (log.status || '').toUpperCase() === 'SENT').length
    const failed = logs.filter((log) => (log.status || '').toUpperCase() === 'FAILED').length
    const pending = logs.filter((log) => (log.status || '').toUpperCase() === 'PENDING').length

    return {
      total: logs.length,
      sent,
      failed,
      pending,
    }
  }, [logs])

  async function handleSendMail(event: FormEvent) {
    event.preventDefault()

    setSendingMail(true)
    setMailError('')
    setMailMessage('')

    try {
      const payload = {
        to_email: mailForm.to_email.trim(),
        subject: mailForm.subject.trim(),
        content: mailForm.content.trim(),
        html: mailForm.html.trim() || undefined,
      }

      await api.post('/api/v1/mail/sendto', payload)
      setMailMessage('Đã gửi email thành công.')
      setMailForm({
        to_email: '',
        subject: '',
        content: '',
        html: '',
      })
    } catch (err: unknown) {
      setMailError(normalizeError(err, 'Không gửi được email.'))
    } finally {
      setSendingMail(false)
    }
  }

  async function handleExportUsers() {
    setExporting(true)
    setExportError('')
    setExportMessage('')

    try {
      const response = await api.post(
        '/api/v1/export/users',
        {
          filter: buildExportFilter(exportTarget),
        },
        {
          responseType: 'blob',
        },
      )

      downloadBlob(
        new Blob([response.data], {
          type:
            response.headers?.['content-type'] ||
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        getExportFileName(exportTarget),
      )
      setExportMessage('File export đã sẵn sàng và đang được tải xuống.')
    } catch (err: unknown) {
      setExportError(normalizeError(err, 'Không xuất được file.'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="vb-page vb-dashboard-page vb-seasons-page">
      <Navbar />

      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Vận hành web</p>
          <h1>Gửi email, export dữ liệu và xem nhật ký hệ thống</h1>
          <p className="vb-admin-lead">
            Đây là trang vận hành web dành cho TECH_ADMIN: làm việc với mail, file export và nhật ký email ngay trong trình duyệt.
          </p>
        </div>
      </section>

      <section className="vb-tw-stats-grid vb-tw-stats-grid-2">
        <article className="vb-season-panel">
          <p className="vb-overline">Tổng log</p>
          <strong className="vb-province-kpi-value">{stats.total}</strong>
          <span className="vb-province-kpi-label">Tất cả bản ghi email_logs đang có</span>
        </article>
        <article className="vb-season-panel">
          <p className="vb-overline">Thành công / lỗi</p>
          <strong className="vb-province-kpi-value">
            {stats.sent} / {stats.failed}
          </strong>
          <span className="vb-province-kpi-label">{stats.pending} bản ghi đang ở trạng thái pending</span>
        </article>
      </section>

      {mailError ? <section className="vb-account-banner is-error">{mailError}</section> : null}
      {mailMessage ? <section className="vb-account-banner is-success">{mailMessage}</section> : null}
      {exportError ? <section className="vb-account-banner is-error">{exportError}</section> : null}
      {exportMessage ? <section className="vb-account-banner is-success">{exportMessage}</section> : null}
      {logsError ? <section className="vb-account-banner is-error">{logsError}</section> : null}
      {logsLoading ? <section className="vb-account-banner">Đang tải nhật ký email...</section> : null}

      <section className="vb-season-layout">
        <section className="vb-season-panel">
          <div className="vb-section-head is-compact">
            <div>
              <p className="vb-overline">Gửi mail</p>
              <h2>Soạn và gửi email</h2>
            </div>
          </div>

          <form className="vb-season-form" onSubmit={handleSendMail}>
            <div className="vb-form-grid">
              <div className="vb-field vb-full">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={mailForm.to_email}
                  onChange={(e) => setMailForm((prev) => ({ ...prev, to_email: e.target.value }))}
                  type="email"
                  required
                />
                <label className="vb-float-label">Email người nhận</label>
              </div>
              <div className="vb-field vb-full">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={mailForm.subject}
                  onChange={(e) => setMailForm((prev) => ({ ...prev, subject: e.target.value }))}
                  required
                />
                <label className="vb-float-label">Tiêu đề email</label>
              </div>
              <div className="vb-field vb-full">
                <textarea
                  className="vb-input vb-textarea"
                  placeholder=" "
                  value={mailForm.content}
                  onChange={(e) => setMailForm((prev) => ({ ...prev, content: e.target.value }))}
                  required
                />
                <label className="vb-float-label">Nội dung text</label>
              </div>
              <div className="vb-field vb-full">
                <textarea
                  className="vb-input vb-textarea"
                  placeholder=" "
                  value={mailForm.html}
                  onChange={(e) => setMailForm((prev) => ({ ...prev, html: e.target.value }))}
                />
                <label className="vb-float-label">Nội dung HTML tuỳ chọn</label>
              </div>
            </div>

            <div className="vb-modal-actions">
              <button type="submit" className="vb-tw-btn-primary" disabled={sendingMail}>
                {sendingMail ? 'Đang gửi...' : 'Gửi email'}
              </button>
            </div>
          </form>
        </section>

        <section className="vb-season-panel">
          <div className="vb-section-head is-compact">
            <div>
              <p className="vb-overline">Export</p>
              <h2>Xuất file users.xlsx</h2>
            </div>
          </div>

          <div className="vb-season-form">
            <div className="vb-form-grid">
              <div className="vb-field vb-full">
                <label className="vb-label" htmlFor="export-target">
                  Chọn phạm vi export
                </label>
                <select
                  id="export-target"
                  className="vb-select"
                  value={exportTarget}
                  onChange={(e) => setExportTarget(e.target.value as ExportTarget)}
                >
                  {exportTargetOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="vb-account-banner">
              Export sử dụng API <code>/api/v1/export/users</code> và sẽ tải file Excel xuống máy của bạn.
            </p>

            <div className="vb-modal-actions">
              <button type="button" className="vb-tw-btn-primary" onClick={() => void handleExportUsers()} disabled={exporting}>
                {exporting ? 'Đang xuất...' : 'Tải file export'}
              </button>
            </div>
          </div>
        </section>
      </section>

      <section className="vb-season-panel">
        <div className="vb-section-head is-compact">
          <div>
            <p className="vb-overline">Email logs</p>
            <h2>Nhật ký gửi email</h2>
          </div>
          <p className="vb-section-note">{filteredLogs.length} bản ghi khớp điều kiện.</p>
        </div>

        <div className="vb-tw-toolbar-row">
          <div className="vb-account-search">
            <label htmlFor="log-search">Tìm kiếm log</label>
            <input
              id="log-search"
              className="vb-input"
              placeholder="email, template, subject, error..."
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
            />
          </div>

          <div className="vb-tw-role-filter">
            <label htmlFor="log-status">Trạng thái</label>
            <select
              id="log-status"
              className="vb-toolbar-select"
              value={logStatusFilter}
              onChange={(e) => setLogStatusFilter(e.target.value as (typeof logStatusOptions)[number])}
            >
              {logStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="vb-tw-toolbar-cta">
            <button type="button" className="vb-tw-btn-muted" onClick={() => void loadLogs()}>
              Làm mới log
            </button>
          </div>
        </div>

        <div className="vb-account-table-wrap">
          <table className="vb-account-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Template</th>
                <th>Tiêu đề</th>
                <th>Trạng thái</th>
                <th>Gửi lúc</th>
                <th>Lỗi</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <strong>{log.email || 'N/A'}</strong>
                    <span>ID người dùng: {log.user_id ?? 'N/A'}</span>
                  </td>
                  <td>{log.template_code || 'N/A'}</td>
                  <td>{log.subject || 'N/A'}</td>
                  <td>
                    <span className={`vb-status-pill is-${(log.status || 'unknown').toLowerCase()}`}>
                      {log.status || 'N/A'}
                    </span>
                  </td>
                  <td>{formatDateTime(log.sent_at)}</td>
                  <td>{log.error_message || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
