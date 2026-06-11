import axios from 'axios'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getDashboardPathForRole } from '../auth/role'
import { api, apiBaseUrl } from '../api/api'
import { useAuth } from '../context/useAuth'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setUser } = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const googleAuthUrl = useMemo(() => {
    const baseUrl = apiBaseUrl || window.location.origin
    return new URL('/api/v1/auth/google', baseUrl).toString()
  }, [])

  const queryError = searchParams.get('error')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await api.post('/api/v1/auth/login', form)
      const user = response.data?.data ?? null
      setUser(user)
      navigate(getDashboardPathForRole(user?.role_code, user?.profile_completed), { replace: true })
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.'
        : 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.'
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
          <h1 className="vb-auth-title">Đăng nhập</h1>

          <div className="vb-field">
            <input
              id="username"
              className="vb-input"
              placeholder=" "
              value={form.username}
              onChange={(e) => setForm((v) => ({ ...v, username: e.target.value }))}
              required
            />
            <label className="vb-float-label" htmlFor="username">Tên đăng nhập</label>
          </div>

          <div className="vb-field">
            <input
              id="password"
              type="password"
              className="vb-input"
              placeholder=" "
              value={form.password}
              onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
              required
            />
            <label className="vb-float-label" htmlFor="password">Mật khẩu</label>
          </div>

          {(error || queryError) && <p className="vb-form-error">{error || queryError}</p>}

          <button type="submit" className="vb-btn vb-btn-primary vb-btn-full" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

          <div className="vb-auth-divider"><span>hoặc</span></div>

          <button
            type="button"
            className="vb-btn vb-btn-google vb-btn-full"
            onClick={() => {
              window.location.href = googleAuthUrl
            }}
          >
            <svg className="vb-google-icon" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.61 20.08H42V20H24v8h11.3c-1.65 4.66-6.08 8-11.3 8-6.63 0-12-5.37-12-12s5.37-12 12-12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.04 6.05 29.27 4 24 4 12.96 4 4 12.96 4 24s8.96 20 20 20 20-8.96 20-20c0-1.34-.14-2.65-.39-3.92z" />
              <path fill="#FF3D00" d="M6.31 14.69l6.57 4.82C14.66 15.11 18.96 12 24 12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.04 6.05 29.27 4 24 4 16.32 4 9.59 8.34 6.31 14.69z" />
              <path fill="#4CAF50" d="M24 44c5.17 0 9.86-1.98 13.41-5.19l-6.19-5.24c-2.08 1.44-4.51 2.29-7.22 2.29-5.2 0-9.62-3.33-11.28-7.95l-6.52 5.02C9.46 39.56 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.61 20.08H42V20H24v8h11.3c-.79 2.21-2.2 4.12-4.08 5.57l.01-.01 6.19 5.24C36.98 39.2 44 34 44 24c0-1.34-.14-2.65-.39-3.92z" />
            </svg>
            Tiếp tục với Google
          </button>

          <p className="vb-auth-helper">
            Quên mật khẩu? <Link to="/forgot-password">Lấy lại mật khẩu</Link>
          </p>
          <p className="vb-auth-helper">
            Chưa có tài khoản? <Link to="/register">Đăng ký tại đây</Link>
          </p>
          <p className="vb-auth-helper">
            <Link to="/">Quay về trang chủ</Link>
          </p>
        </form>
      </section>
    </main>
  )
}
