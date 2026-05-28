import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <header className="vb-nav">
      <div className="vb-nav-main">
        <div className="vb-brand-wrap">
          <Link to="/" aria-label="Về trang chủ">
            <img className="vb-logo" src="/chuhieu.png" alt="Nhật ký Hoa phượng đỏ" />
          </Link>
        </div>

        <nav className="vb-desktop-nav">
          <Link to="/login">Đăng nhập</Link>
          <Link to="/register">Đăng ký</Link>
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
        <Link to="/login" onClick={closeMenu}>Đăng nhập</Link>
        <Link to="/register" onClick={closeMenu}>Đăng ký</Link>
      </div>
    </header>
  )
}
