import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import ProvinceSelector, { type ProvinceOption } from '../components/ProvinceSelector'
import WardSelector, { type WardOption } from '../components/WardSelector'

const INITIAL = {
  username: '',
  password: '',
  full_name: '',
  email: '',
  phone: '',
  province_name: '',
  ward_name: '',
  school_name: '',
  work_unit: '',
  organization_position: '',
  role_id: 4,
}

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedProvince, setSelectedProvince] = useState<ProvinceOption | null>(null)
  const [selectedWard, setSelectedWard] = useState<WardOption | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedProvince || !selectedWard) {
      setError('Vui lòng chọn Tỉnh/Thành phố và Phường/Xã.')
      return
    }

    setLoading(true)
    try {
      await api.post('/api/v1/auth/register', {
        ...form,
        province_code: String(selectedProvince.code),
        province_name: selectedProvince.name,
        ward_name: selectedWard.name,
      })
      setSuccess('Đăng ký thành công. Bạn có thể đăng nhập ngay.')
      setTimeout(() => navigate('/login'), 1000)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="vb-auth-page">
      <section className="vb-auth-wrap">
        <form className="vb-auth-card" onSubmit={onSubmit}>
          <img src="/logo.png" alt="Logo cuộc thi" className="vb-auth-logo" />

          <h1 className="vb-auth-title">Đăng ký tài khoản</h1>

          <div className="vb-form-grid">
            <div className="vb-field"><input id="username" className="vb-input" placeholder=" " value={form.username} onChange={(e) => setForm((v) => ({ ...v, username: e.target.value }))} required /><label className="vb-float-label" htmlFor="username">Tên đăng nhập <span className="vb-required">*</span></label></div>
            <div className="vb-field"><input id="password" type="password" className="vb-input" placeholder=" " value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} required /><label className="vb-float-label" htmlFor="password">Mật khẩu <span className="vb-required">*</span></label></div>
            <div className="vb-field"><input id="full_name" className="vb-input" placeholder=" " value={form.full_name} onChange={(e) => setForm((v) => ({ ...v, full_name: e.target.value }))} required /><label className="vb-float-label" htmlFor="full_name">Họ và tên <span className="vb-required">*</span></label></div>
            <div className="vb-field"><input id="email" type="email" className="vb-input" placeholder=" " value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} required /><label className="vb-float-label" htmlFor="email">Email <span className="vb-required">*</span></label></div>
            <div className="vb-field"><input id="phone" className="vb-input" placeholder=" " value={form.phone} onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))} /><label className="vb-float-label" htmlFor="phone">Số điện thoại</label></div>
            <div className="vb-field"><input id="school_name" className="vb-input" placeholder=" " value={form.school_name} onChange={(e) => setForm((v) => ({ ...v, school_name: e.target.value }))} /><label className="vb-float-label" htmlFor="school_name">Trường học</label></div>

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

            <div className="vb-field"><input id="work_unit" className="vb-input" placeholder=" " value={form.work_unit} onChange={(e) => setForm((v) => ({ ...v, work_unit: e.target.value }))} /><label className="vb-float-label" htmlFor="work_unit">Đơn vị công tác</label></div>
            <div className="vb-field"><input id="organization_position" className="vb-input" placeholder=" " value={form.organization_position} onChange={(e) => setForm((v) => ({ ...v, organization_position: e.target.value }))} /><label className="vb-float-label" htmlFor="organization_position">Chức vụ Đoàn/Hội/Đội</label></div>
          </div>

          {error && <p className="vb-form-error">{error}</p>}
          {success && <p className="vb-form-success">{success}</p>}

          <button type="submit" className="vb-btn vb-btn-primary vb-btn-full" disabled={loading}>
            {loading ? 'Đang đăng ký...' : 'Tạo tài khoản'}
          </button>

          <div className="vb-auth-divider"><span>hoặc</span></div>

          <button type="button" className="vb-btn vb-btn-google vb-btn-full">
            <svg className="vb-google-icon" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.61 20.08H42V20H24v8h11.3c-1.65 4.66-6.08 8-11.3 8-6.63 0-12-5.37-12-12s5.37-12 12-12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.04 6.05 29.27 4 24 4 12.96 4 4 12.96 4 24s8.96 20 20 20 20-8.96 20-20c0-1.34-.14-2.65-.39-3.92z" />
              <path fill="#FF3D00" d="M6.31 14.69l6.57 4.82C14.66 15.11 18.96 12 24 12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.04 6.05 29.27 4 24 4 16.32 4 9.59 8.34 6.31 14.69z" />
              <path fill="#4CAF50" d="M24 44c5.17 0 9.86-1.98 13.41-5.19l-6.19-5.24c-2.08 1.44-4.51 2.29-7.22 2.29-5.2 0-9.62-3.33-11.28-7.95l-6.52 5.02C9.46 39.56 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.61 20.08H42V20H24v8h11.3c-.79 2.21-2.2 4.12-4.08 5.57l.01-.01 6.19 5.24C36.98 39.2 44 34 44 24c0-1.34-.14-2.65-.39-3.92z" />
            </svg>
            Tiếp tục với Google
          </button>

          <p className="vb-auth-helper">
            Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
          </p>
          <p className="vb-auth-helper">
            <Link to="/">Quay về trang chủ</Link>
          </p>
        </form>
      </section>
    </main>
  )
}
