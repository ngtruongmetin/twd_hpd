import { useState } from 'react'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <header className="vb-nav">
      <div className="vb-nav-main">
        <div className="vb-brand-wrap">
          <a href="/" aria-label="Về trang chủ">
            <img className="vb-logo" src="/chuhieu.png" alt="Nhật ký Hoa phượng đỏ" />
          </a>

        </div>

        <nav className="vb-desktop-nav">

          <a href="/login">Đăng nhập</a>
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
        <a href="/login" onClick={closeMenu}>Đăng nhập</a>
      </div>
    </header>
  )
}
