import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboardPathForRole } from '../auth/role'
import { useAuth } from '../context/useAuth'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, loading, logout } = useAuth()

  function closeMenu() {
    setMenuOpen(false)
  }

  async function handleLogout() {
    await logout()
    closeMenu()
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
    </header>
  )
}
