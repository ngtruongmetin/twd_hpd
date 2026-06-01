import axios from 'axios'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Navbar from '../../components/Navbar'
import { api } from '../../api/api'

type UserRow = {
  id: number
  username: string
  full_name: string
  email: string | null
  phone: string | null
  province_name: string | null
  ward_name: string | null
  school_name: string | null
  role_code: string | null
  status: string | null
}

type CreateForm = {
  username: string
  password: string
  full_name: string
  email: string
  phone: string
  province_name: string
  ward_name: string
  school_name: string
  role_id: '3' | '5'
}

const PAGE_SIZE = 10

const initialForm: CreateForm = {
  username: '',
  password: '',
  full_name: '',
  email: '',
  phone: '',
  province_name: '',
  ward_name: '',
  school_name: '',
  role_id: '3',
}

function normalizeError(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) return err.response?.data?.message || fallback
  return fallback
}

export default function TwAdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'PROVINCE_ADMIN' | 'JUDGE'>('ALL')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingUsername, setDeletingUsername] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<CreateForm>(initialForm)

  async function loadUsers() {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/api/v1/users')
      setUsers((response.data?.data ?? []) as UserRow[])
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không tải được danh sách người dùng.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return users.filter((user) => {
      const roleOk = roleFilter === 'ALL' || user.role_code === roleFilter
      const queryOk =
        !normalized ||
        [user.username, user.full_name, user.email, user.phone, user.province_name, user.ward_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized))
      return roleOk && queryOk
    })
  }, [users, query, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pagedUsers = filteredUsers.slice(start, start + PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [query, roleFilter])

  async function handleCreateUser(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await api.post('/api/v1/auth/register', { ...form, role_id: Number(form.role_id) })
      setMessage('Đã tạo tài khoản mới.')
      setForm(initialForm)
      await loadUsers()
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không tạo được tài khoản.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteUser(username: string) {
    const confirmed = window.confirm(`Xóa tài khoản ${username}?`)
    if (!confirmed) return
    setDeletingUsername(username)
    setError('')
    setMessage('')
    try {
      await api.delete(`/api/v1/users/${username}`)
      setMessage('Đã xóa tài khoản.')
      await loadUsers()
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không xóa được tài khoản.'))
    } finally {
      setDeletingUsername('')
    }
  }

  return (
    <main className="vb-page vb-dashboard-page vb-tw-users-page">
      <Navbar />
      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">TW_ADMIN</p>
          <h1>Quản lý người dùng</h1>
          <p className="vb-admin-lead">Xem thông tin chính, tạo tài khoản PROVINCE_ADMIN/JUDGE và xóa tài khoản.</p>
        </div>
      </section>

      {error ? <section className="vb-account-banner is-error">{error}</section> : null}
      {message ? <section className="vb-account-banner">{message}</section> : null}
      {loading ? <section className="vb-account-banner">Đang tải dữ liệu...</section> : null}

      <section className="vb-tw-layout">
        <article className="vb-season-panel">
          <div className="vb-section-head is-compact">
            <div>
              <p className="vb-overline">Danh sách</p>
              <h2>Tài khoản</h2>
            </div>
          </div>

          <div className="vb-account-toolbar">
            <div className="vb-account-search">
              <label htmlFor="tw-user-search">Tìm kiếm</label>
              <input
                id="tw-user-search"
                className="vb-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="username, họ tên, email, tỉnh, phường..."
              />
            </div>
            <div className="vb-account-filters">
              <div>
                <label htmlFor="tw-user-role">Role</label>
                <select
                  id="tw-user-role"
                  className="vb-select"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as 'ALL' | 'PROVINCE_ADMIN' | 'JUDGE')}
                >
                  <option value="ALL">Tất cả role</option>
                  <option value="PROVINCE_ADMIN">PROVINCE_ADMIN</option>
                  <option value="JUDGE">JUDGE</option>
                </select>
              </div>
            </div>
          </div>

          <div className="vb-account-table-wrap">
            <table className="vb-account-table">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Liên hệ</th>
                  <th>Địa bàn</th>
                  <th>Trường</th>
                  <th>Role</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.username}</strong><span>{user.full_name}</span></td>
                    <td><span>{user.email || 'N/A'}</span><span>{user.phone || 'N/A'}</span></td>
                    <td><span>{user.province_name || 'N/A'}</span><span>{user.ward_name || 'N/A'}</span></td>
                    <td><span>{user.school_name || 'N/A'}</span></td>
                    <td><span className="vb-role-pill">{user.role_code || 'N/A'}</span><span>{user.status || 'N/A'}</span></td>
                    <td>
                      {['PROVINCE_ADMIN', 'JUDGE'].includes(user.role_code || '') ? (
                        <button type="button" className="vb-tw-btn-danger" onClick={() => void handleDeleteUser(user.username)}>
                          {deletingUsername === user.username ? 'Đang xóa...' : 'Xóa'}
                        </button>
                      ) : (
                        <span>N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="vb-tw-pagination">
            <button type="button" className="vb-tw-btn-muted" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trang trước</button>
            <span>Trang {safePage}/{totalPages}</span>
            <button type="button" className="vb-tw-btn-muted" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Trang sau</button>
          </div>
        </article>

        <article className="vb-season-panel">
          <div className="vb-section-head is-compact">
            <div>
              <p className="vb-overline">Tạo tài khoản</p>
              <h2>PROVINCE_ADMIN / JUDGE</h2>
            </div>
          </div>
          <form className="vb-season-form" onSubmit={handleCreateUser}>
            <div className="vb-form-grid">
              <div className="vb-field"><input className="vb-input" placeholder=" " value={form.username} onChange={(e) => setForm((c) => ({ ...c, username: e.target.value }))} required /><label className="vb-float-label">Username</label></div>
              <div className="vb-field"><input className="vb-input" type="password" placeholder=" " value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} required /><label className="vb-float-label">Mật khẩu</label></div>
              <div className="vb-field"><input className="vb-input" placeholder=" " value={form.full_name} onChange={(e) => setForm((c) => ({ ...c, full_name: e.target.value }))} required /><label className="vb-float-label">Họ và tên</label></div>
              <div className="vb-field"><input className="vb-input" type="email" placeholder=" " value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} required /><label className="vb-float-label">Email</label></div>
              <div className="vb-field"><input className="vb-input" placeholder=" " value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} /><label className="vb-float-label">Số điện thoại</label></div>
              <div className="vb-field">
                <select className="vb-select" value={form.role_id} onChange={(e) => setForm((c) => ({ ...c, role_id: e.target.value as '3' | '5' }))}>
                  <option value="3">PROVINCE_ADMIN</option>
                  <option value="5">JUDGE</option>
                </select>
              </div>
              <div className="vb-field"><input className="vb-input" placeholder=" " value={form.province_name} onChange={(e) => setForm((c) => ({ ...c, province_name: e.target.value }))} /><label className="vb-float-label">Tỉnh/Thành</label></div>
              <div className="vb-field"><input className="vb-input" placeholder=" " value={form.ward_name} onChange={(e) => setForm((c) => ({ ...c, ward_name: e.target.value }))} /><label className="vb-float-label">Phường/Xã</label></div>
              <div className="vb-field vb-full"><input className="vb-input" placeholder=" " value={form.school_name} onChange={(e) => setForm((c) => ({ ...c, school_name: e.target.value }))} /><label className="vb-float-label">Trường học</label></div>
            </div>
            <div className="vb-modal-actions">
              <button type="submit" className="vb-tw-btn-primary" disabled={submitting}>{submitting ? 'Đang tạo...' : 'Tạo tài khoản'}</button>
            </div>
          </form>
        </article>
      </section>
    </main>
  )
}
