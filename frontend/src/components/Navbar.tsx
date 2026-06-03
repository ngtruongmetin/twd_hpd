import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { api } from '../api/api'
import { getDashboardPathForRole } from '../auth/role'
import { useAuth } from '../context/useAuth'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const passwordCloseTimerRef = useRef<number | null>(null)
  const { user, loading, logout } = useAuth()

  useEffect(() => {
    return () => {
      if (passwordCloseTimerRef.current !== null) {
        window.clearTimeout(passwordCloseTimerRef.current)
      }
    }
  }, [])

  function clearPasswordCloseTimer() {
    if (passwordCloseTimerRef.current !== null) {
      window.clearTimeout(passwordCloseTimerRef.current)
      passwordCloseTimerRef.current = null
    }
  }

  function closeMenu() {
    setMenuOpen(false)
  }

  function closePasswordModal() {
    clearPasswordCloseTimer()
    setPasswordModalOpen(false)
    setPasswordSuccess(false)
    setPasswordError('')
    setPasswordMessage('')
    setPasswordForm({
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
  }

  async function handleLogout() {
    await logout()
    closeMenu()
    closePasswordModal()
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault()
    if (!user?.username) {
      setPasswordError('Không tìm thấy thông tin tài khoản hiện tại.')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Mật khẩu mới và xác nhận mật khẩu không khớp.')
      return
    }

    clearPasswordCloseTimer()
    setPasswordLoading(true)
    setPasswordSuccess(false)
    setPasswordError('')
    setPasswordMessage('')

    try {
      const response = await api.post('/api/v1/password/change', {
        username: user.username,
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      })

      setPasswordMessage(response.data?.message || 'Đổi mật khẩu thành công.')
      setPasswordSuccess(true)
      setPasswordForm({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      })

      passwordCloseTimerRef.current = window.setTimeout(() => {
        closePasswordModal()
      }, 1500)
    } catch (err: unknown) {
      setPasswordSuccess(false)
      clearPasswordCloseTimer()
      if (axios.isAxiosError(err)) {
        setPasswordError(err.response?.data?.message || 'Không đổi được mật khẩu.')
      } else {
        setPasswordError('Không đổi được mật khẩu.')
      }
    } finally {
      setPasswordLoading(false)
    }
  }

  const dashboardPath = getDashboardPathForRole(user?.role_code)

  return (
    <header className="vb-nav">
      <div className="vb-nav-main">
        <div className="vb-brand-wrap">
          <Link to="/" aria-label="Về trang chủ">
            <img className="vb-logo" src="/chuhieu.png" alt="Nhật ký Hoa phượng đỏ" />
          </Link>
        </div>

        <nav className="vb-desktop-nav">
          {!loading && user ? (
            <>
              <Link to={dashboardPath}>Dashboard</Link>
              <button type="button" className="vb-nav-action" onClick={() => setPasswordModalOpen(true)}>
                Đổi mật khẩu
              </button>
              <button type="button" className="vb-nav-action" onClick={handleLogout}>
                Đăng xuất
              </button>
            </>
          ) : (
            <Link to="/login">Đăng nhập</Link>
          )}
        </nav>

        <button
          type="button"
          className="vb-hamburger"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={menuOpen}
        >
          <span className={`vb-bar ${menuOpen ? 'is-open-top' : ''}`} />
          <span className={`vb-bar ${menuOpen ? 'is-open-mid' : ''}`} />
          <span className={`vb-bar ${menuOpen ? 'is-open-bot' : ''}`} />
        </button>
      </div>

      <div className={`vb-mobile-menu ${menuOpen ? 'is-open' : ''}`}>
        {!loading && user ? (
          <>
            <Link to={dashboardPath} onClick={closeMenu}>
              Dashboard
            </Link>
            <button
              type="button"
              className="vb-mobile-action"
              onClick={() => {
                closeMenu()
                setPasswordModalOpen(true)
              }}
            >
              Đổi mật khẩu
            </button>
            <button type="button" className="vb-mobile-action" onClick={handleLogout}>
              Đăng xuất
            </button>
          </>
        ) : (
          <Link to="/login" onClick={closeMenu}>
            Đăng nhập
          </Link>
        )}
      </div>

      {passwordModalOpen && user ? (
        <div className="vb-modal-backdrop" role="presentation" onClick={closePasswordModal}>
          <section
            className="vb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="vb-modal-head">
              <div>
                <p className="vb-overline">Tài khoản</p>
                <h2 id="change-password-title">Đổi mật khẩu</h2>
                <p className="vb-modal-sub">Đang đăng nhập với tài khoản {user.username}</p>
              </div>
              <button type="button" className="vb-modal-close" onClick={closePasswordModal}>
                Đóng
              </button>
            </div>

            <form className="vb-modal-body vb-modal-form" onSubmit={handleChangePassword}>
              <div className="vb-modal-layout">
                <div className="vb-modal-main">
                  {passwordError ? <p className="vb-account-banner is-error">{passwordError}</p> : null}
                  {passwordMessage ? (
                    <p className={`vb-account-banner ${passwordSuccess ? 'is-success' : ''}`}>
                      {passwordMessage}
                    </p>
                  ) : null}

                  <div className="vb-judge-criteria-list">
                    <div className="vb-field">
                      <input
                        className="vb-input"
                        type="password"
                        placeholder=" "
                        value={passwordForm.oldPassword}
                        onChange={(e) =>
                          setPasswordForm((value) => ({ ...value, oldPassword: e.target.value }))
                        }
                        required
                      />
                      <label className="vb-float-label">Mật khẩu cũ</label>
                    </div>

                    <div className="vb-field">
                      <input
                        className="vb-input"
                        type="password"
                        placeholder=" "
                        value={passwordForm.newPassword}
                        onChange={(e) =>
                          setPasswordForm((value) => ({ ...value, newPassword: e.target.value }))
                        }
                        required
                      />
                      <label className="vb-float-label">Mật khẩu mới</label>
                    </div>

                    <div className="vb-field">
                      <input
                        className="vb-input"
                        type="password"
                        placeholder=" "
                        value={passwordForm.confirmPassword}
                        onChange={(e) =>
                          setPasswordForm((value) => ({ ...value, confirmPassword: e.target.value }))
                        }
                        required
                      />
                      <label className="vb-float-label">Xác nhận mật khẩu mới</label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="vb-modal-actions">
                <button type="submit" className="vb-tw-btn-primary" disabled={passwordLoading}>
                  {passwordLoading ? 'Đang lưu...' : passwordSuccess ? 'Đã đổi xong' : 'Đổi mật khẩu'}
                </button>
                <button type="button" className="vb-tw-btn-muted" onClick={closePasswordModal}>
                  Hủy
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </header>
  )
}
