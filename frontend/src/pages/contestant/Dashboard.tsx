import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../../components/Navbar'
import { getDashboardTitleForRole, type SessionUser } from '../../auth/role'
import { useAuth } from '../../context/useAuth'
import { api } from '../../api/api'

type ProfileDraft = {
  full_name: string
  email: string
  phone: string
  facebook_post_url: string
  school_name: string
  work_unit: string
  organization_position: string
}

const emptyDraft: ProfileDraft = {
  full_name: '',
  email: '',
  phone: '',
  facebook_post_url: '',
  school_name: '',
  work_unit: '',
  organization_position: '',
}

function createDraftFromUser(user: SessionUser | null): ProfileDraft {
  return {
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    facebook_post_url: user?.facebook_post_url || '',
    school_name: user?.school_name || '',
    work_unit: user?.work_unit || '',
    organization_position: user?.organization_position || '',
  }
}

function isFacebookLink(value: string) {
  try {
    const url = new URL(value)
    return /(^|\.)facebook\.com$/i.test(url.hostname)
  } catch {
    return false
  }
}

export default function ContestantDashboard() {
  const { user, setUser } = useAuth()
  const title = getDashboardTitleForRole(user?.role_code)
  const displayName = user?.full_name || user?.username || 'CONTESTANT'
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(createDraftFromUser(user))
  }, [user])

  const profileCards = useMemo(
    () => [
      { label: 'Username', value: user?.username || 'unknown' },
      { label: 'Email', value: user?.email || 'Chưa bổ sung' },
      { label: 'Số điện thoại', value: user?.phone || 'Chưa bổ sung' },
      { label: 'Tỉnh/Thành phố', value: user?.province_name || 'Chưa bổ sung' },
      { label: 'Phường/Xã', value: user?.ward_name || 'Chưa bổ sung' },
    ],
    [draft.facebook_post_url, user?.facebook_post_url, user?.email, user?.phone, user?.province_name, user?.role_code, user?.role_name, user?.school_name, user?.username, user?.ward_name],
  )

  const profileReady = Boolean(
    draft.email.trim() &&
    draft.phone.trim(),
  )

  async function handleSaveDraft() {
    setSaving(true)
    setMessage('')

    try {
      const response = await api.put('/api/v1/auth/me', {
        school_name: draft.school_name || null,
        email: draft.email || null,
        phone: draft.phone || null,
        work_unit: draft.work_unit || null,
        organization_position: draft.organization_position || null,
        facebook_post_url: draft.facebook_post_url || null,
      })

      setUser(response.data?.data ?? null)
      setMessage('Đã lưu hồ sơ thành công.')
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || 'Không lưu được hồ sơ.'
        : 'Không lưu được hồ sơ.'
      setMessage(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="vb-page vb-dashboard-page vb-contestant-page">
      <Navbar />

      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Hồ sơ thí sinh</p>
          <h1>{title}</h1>
          <p className="vb-admin-lead">
            Trang này dùng để cập nhật thông tin cá nhân và bổ sung hồ sơ dự thi.
          </p>
          <div className="vb-chip-row">
            <span className="vb-chip">{displayName}</span>
            <Link className="vb-chip vb-chip-active" to="/dashboard/contestant/submissions">
              Đi tới nộp bài
            </Link>
          </div>
        </div>

        <aside className="vb-admin-session">
          <h2>Thông tin thí sinh </h2>
          <dl className="vb-session-list">
            {profileCards.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <section className="vb-contestant-grid">
        <article className="vb-contestant-panel vb-contestant-profile">
          <div className="vb-section-head is-compact">
            <div>
              <p className="vb-overline">Thông tin cá nhân</p>
              <h2>Chỉnh sửa hồ sơ</h2>
            </div>
          </div>

          <div className="vb-contestant-form">
            <div className="vb-form-grid">
              <div className="vb-field">
                <input className="vb-input" placeholder=" " value={user?.username || ''} disabled readOnly />
                <label className="vb-float-label">Username</label>
              </div>
              <div className="vb-field">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={user?.full_name || ''}
                  disabled
                  readOnly
                />
                <label className="vb-float-label">Họ và tên</label>
              </div>
              <div className="vb-field">
                <input
                  type="email"
                  className="vb-input"
                  placeholder=" "
                  value={draft.email}
                  disabled
                  readOnly
                />
                <label className="vb-float-label">Email</label>
              </div>
              <div className="vb-field">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={draft.phone}
                  disabled
                  readOnly
                />
                <label className="vb-float-label">Số điện thoại</label>
              </div>
              <div className="vb-field">
                <input className="vb-input" placeholder=" " value={user?.province_name || ''} disabled readOnly />
                <label className="vb-float-label">Tỉnh thành</label>
              </div>
              <div className="vb-field">
                <input className="vb-input" placeholder=" " value={user?.ward_name || ''} disabled readOnly />
                <label className="vb-float-label">Phường / Xã</label>
              </div>
              <div className="vb-field vb-full">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={draft.facebook_post_url}
                  onChange={(e) => setDraft((current) => ({ ...current, facebook_post_url: e.target.value }))}
                />
                <label className="vb-float-label">Link bài đăng Facebook thẻ chiến sĩ HPĐ</label>
              </div>
              <div className="vb-field">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={draft.school_name}
                  onChange={(e) => setDraft((current) => ({ ...current, school_name: e.target.value }))}
                />
                <label className="vb-float-label">Trường học</label>
              </div>
              <div className="vb-field">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={draft.work_unit}
                  onChange={(e) => setDraft((current) => ({ ...current, work_unit: e.target.value }))}
                />
                <label className="vb-float-label">Đơn vị công tác</label>
              </div>
              <div className="vb-field vb-full">
                <input
                  className="vb-input"
                  placeholder=" "
                  value={draft.organization_position}
                  onChange={(e) => setDraft((current) => ({ ...current, organization_position: e.target.value }))}
                />
                <label className="vb-float-label">Chức vụ Đoàn/Hội/Đội</label>
              </div>
            </div>

            {message ? <p className="vb-form-success">{message}</p> : null}
            {!isFacebookLink(draft.facebook_post_url.trim()) && draft.facebook_post_url.trim() ? (
              <p className="vb-form-error">Link Facebook chưa hợp lệ. Hãy dán đúng link bài đăng Facebook công khai.</p>
            ) : null}

            <div className="vb-modal-actions">
              <button type="button" className="vb-btn vb-btn-primary" onClick={handleSaveDraft} disabled={saving || !profileReady}>
                {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </button>
              <Link className="vb-btn vb-btn-secondary" to="/dashboard/contestant/submissions">
                Đi đến nộp bài
              </Link>
            </div>
          </div>
        </article>
      </section>
    </main>
  )
}
