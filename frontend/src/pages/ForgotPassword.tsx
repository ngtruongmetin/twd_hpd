import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/api'

export default function ForgotPassword() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await api.post('/api/v1/password/forgot', {
        username,
        email,
      })
      setSuccess(response.data?.message || 'Yêu cầu đặt lại mật khẩu đã được gửi.')
      setUsername('')
      setEmail('')
    } catch (err: unknown) {
      setError(
        typeof err === 'object' && err !== null && 'response' in err
          ? ((err as any).response?.data?.message || 'Yêu cầu thất bại. Vui lòng thử lại.')
          : 'Yêu cầu thất bại. Vui lòng thử lại.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="vb-auth-page">
      <section className="vb-auth-wrap">
        <form className="vb-auth-card" onSubmit={onSubmit}>
          <img src="/logo.png" alt="Logo cuộc thi" className="vb-auth-logo" />
          <h1 className="vb-auth-title">Lấy lại mật khẩu</h1>

          <div className="vb-field">
            <input
              id="username"
              className="vb-input"
              placeholder=" "
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <label className="vb-float-label" htmlFor="username">
              Tên đăng nhập
            </label>
          </div>

          <div className="vb-field">
            <input
              id="email"
              type="email"
              className="vb-input"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label className="vb-float-label" htmlFor="email">
              Email đăng ký
            </label>
          </div>

          {error && <p className="vb-form-error">{error}</p>}
          {success && <p className="vb-form-success">{success}</p>}

          <button type="submit" className="vb-btn vb-btn-primary vb-btn-full" disabled={loading}>
            {loading ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu'}
          </button>

          <p className="vb-auth-helper">
            Nhập đúng tên đăng nhập và email đã đăng ký. Mật khẩu mới sẽ được gửi về email.
          </p>

          <p className="vb-auth-helper">
            <Link to="/login">Quay về đăng nhập</Link>
          </p>
          <p className="vb-auth-helper">
            <Link to="/">Quay về trang chủ</Link>
          </p>
        </form>
      </section>
    </main>
  )
}
