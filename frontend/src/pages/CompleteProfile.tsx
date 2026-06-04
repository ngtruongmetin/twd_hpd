import axios from 'axios'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import { getDashboardPathForRole, isProfileCompleted } from '../auth/role'
import ProvinceSelector, { type ProvinceOption } from '../components/ProvinceSelector'
import WardSelector, { type WardOption } from '../components/WardSelector'
import { useAuth } from '../context/useAuth'

type ProfileForm = {
  username: string
  email: string
  full_name: string
  phone: string
  school_name: string
  work_unit: string
  organization_position: string
}

const EMPTY_FORM: ProfileForm = {
  username: '',
  email: '',
  full_name: '',
  phone: '',
  school_name: '',
  work_unit: '',
  organization_position: '',
}

function buildFormFromUser(user: ReturnType<typeof useAuth>['user']) {
  return {
    username: user?.username || '',
    email: user?.email || '',
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    school_name: user?.school_name || '',
    work_unit: user?.work_unit || '',
    organization_position: user?.organization_position || '',
  }
}

export default function CompleteProfile() {
  const navigate = useNavigate()
  const { user, loading, setUser } = useAuth()
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM)
  const [selectedProvince, setSelectedProvince] = useState<ProvinceOption | null>(null)
  const [selectedWard, setSelectedWard] = useState<WardOption | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    setForm(buildFormFromUser(user))

    if (user?.province_code && user?.province_name) {
      const provinceCode = Number(user.province_code)
      if (Number.isFinite(provinceCode)) {
        setSelectedProvince({
          code: provinceCode,
          name: user.province_name,
        })
      }
    } else {
      setSelectedProvince(null)
    }

    setSelectedWard(user?.ward_name ? { code: 0, name: user.ward_name } : null)
  }, [user])

  const profileReady = useMemo(
    () =>
      Boolean(
        form.email.trim() &&
        form.full_name.trim() &&
        form.phone.trim() &&
        selectedProvince &&
        selectedWard,
      ),
    [form.email, form.full_name, form.phone, selectedProvince, selectedWard],
  )

  if (loading) {
    return (
      <main className="vb-auth-page">
        <section className="vb-auth-wrap">
          <div className="vb-auth-card">
            <h1 className="vb-auth-title">Đang tải phiên đăng nhập...</h1>
          </div>
        </section>
      </main>
    )
  }

  if (!loading && !user) {
    return <Navigate to="/login" replace />
  }

  if (!loading && user?.role_code && user.role_code !== 'CONTESTANT') {
    return <Navigate to={getDashboardPathForRole(user.role_code, user.profile_completed)} replace />
  }

  if (!loading && isProfileCompleted(user?.profile_completed)) {
    return <Navigate to={getDashboardPathForRole(user?.role_code, user?.profile_completed)} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!selectedProvince || !selectedWard) {
      setError('Vui lòng chọn Tỉnh/Thành phố và Phường/Xã.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await api.put('/api/v1/auth/me', {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        school_name: form.school_name.trim(),
        work_unit: form.work_unit.trim(),
        organization_position: form.organization_position.trim(),
        province_code: String(selectedProvince.code),
        province_name: selectedProvince.name,
        ward_name: selectedWard.name,
      })

      const updatedUser = response.data?.data ?? null
      setUser(updatedUser)
      setMessage('Đã hoàn thiện hồ sơ. Đang chuyển hướng...')

      window.setTimeout(() => {
        navigate(getDashboardPathForRole(updatedUser?.role_code, updatedUser?.profile_completed), {
          replace: true,
        })
      }, 800)
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || 'Không lưu được hồ sơ.'
        : 'Không lưu được hồ sơ.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="vb-auth-page">
      <section className="vb-auth-wrap">
        <form className="vb-auth-card" onSubmit={handleSubmit}>
          <img src="/logo.png" alt="Logo cuộc thi" className="vb-auth-logo" />

          <h1 className="vb-auth-title">Hoàn thiện hồ sơ</h1>
          <p className="vb-auth-helper vb-auth-helper-spaced">
            Vui lòng bổ sung thông tin còn lại để tiếp tục sử dụng hệ thống.
          </p>

          {message ? <p className="vb-form-success">{message}</p> : null}
          {error ? <p className="vb-form-error">{error}</p> : null}

          <div className="vb-form-grid">
            <div className="vb-field">
              <input className="vb-input" placeholder=" " value={form.username} disabled readOnly />
              <label className="vb-float-label">Username</label>
            </div>
            <div className="vb-field">
              <input className="vb-input" placeholder=" " value={form.email} disabled readOnly />
              <label className="vb-float-label">Email</label>
            </div>
            <div className="vb-field">
              <input
                className="vb-input"
                placeholder=" "
                value={form.full_name}
                onChange={(e) => setForm((current) => ({ ...current, full_name: e.target.value }))}
                required
              />
              <label className="vb-float-label">Họ và tên <span className="vb-required">*</span></label>
            </div>
            <div className="vb-field">
              <input
                className="vb-input"
                placeholder=" "
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                required
              />
              <label className="vb-float-label">Số điện thoại <span className="vb-required">*</span></label>
            </div>

            <ProvinceSelector
              value={selectedProvince}
              onChange={(province) => {
                setSelectedProvince(province)
                setSelectedWard(null)
              }}
            />

            <WardSelector
              provinceCode={selectedProvince?.code ?? null}
              value={selectedWard}
              onChange={setSelectedWard}
            />

            <div className="vb-field">
              <input
                className="vb-input"
                placeholder=" "
                value={form.school_name}
                onChange={(e) => setForm((current) => ({ ...current, school_name: e.target.value }))}
              />
              <label className="vb-float-label">Trường học</label>
            </div>
            <div className="vb-field">
              <input
                className="vb-input"
                placeholder=" "
                value={form.work_unit}
                onChange={(e) => setForm((current) => ({ ...current, work_unit: e.target.value }))}
              />
              <label className="vb-float-label">Đơn vị công tác</label>
            </div>
            <div className="vb-field vb-full">
              <input
                className="vb-input"
                placeholder=" "
                value={form.organization_position}
                onChange={(e) =>
                  setForm((current) => ({ ...current, organization_position: e.target.value }))
                }
              />
              <label className="vb-float-label">Chức vụ Đoàn/Hội/Đội</label>
            </div>
          </div>

          <div className="vb-modal-actions">
            <button type="submit" className="vb-btn vb-btn-primary" disabled={saving || !profileReady}>
              {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
