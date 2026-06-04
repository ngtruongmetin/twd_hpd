import axios from 'axios'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Navbar from '../../components/Navbar'
import { api } from '../../api/api'
import ProvinceSelector, { type ProvinceOption } from '../../components/ProvinceSelector'
import WardSelector, { type WardOption } from '../../components/WardSelector'
import RoleSelector from '../../components/RoleSelector'

type UserRow = {
  id: number
  username: string
  full_name: string
  email: string | null
  phone: string | null
  province_code: string | null
  province_name: string | null
  ward_name: string | null
  school_name: string | null
  work_unit: string | null
  organization_position: string | null
  role_id: number
  role_code: string | null
  status: string | null
}

type FilterRole = 'ALL' | 'TECH_ADMIN' | 'TW_ADMIN' | 'PROVINCE_ADMIN' | 'JUDGE' | 'CONTESTANT'
type CreateRole = '2' | '3' | '4' | '5'
type EditRole = '1' | '2' | '3' | '4' | '5'


type CreateForm = {
  username: string
  password: string
  full_name: string
  email: string
  phone: string
  school_name: string
  work_unit: string
  organization_position: string
  role_id: CreateRole
}

type EditForm = {
  full_name: string
  email: string
  phone: string
  school_name: string
  work_unit: string
  organization_position: string
  role_id: EditRole
}

const PAGE_SIZE = 10

const filterRoleOptions: { value: FilterRole; label: string }[] = [
  { value: 'ALL', label: 'Tất cả vai trò' },
  { value: 'TECH_ADMIN', label: 'Quản trị kỹ thuật' },
  { value: 'TW_ADMIN', label: 'Quản trị trung ương Đoàn' },
  { value: 'PROVINCE_ADMIN', label: 'Quản trị tỉnh/thành Đoàn' },
  { value: 'JUDGE', label: 'Giám khảo' },
  { value: 'CONTESTANT', label: 'Thí sinh' },
]

const createRoleOptions: { value: CreateRole; label: string }[] = [
  { value: '2', label: 'Quản trị trung ương Đoàn' },
  { value: '3', label: 'Quản trị tỉnh/thành Đoàn' },
  { value: '5', label: 'Giám khảo' },
  { value: '4', label: 'Thí sinh' },
]

const editRoleOptions: { value: EditRole; label: string }[] = [
  { value: '1', label: 'Quản trị kỹ thuật' },
  { value: '2', label: 'Quản trị trung ương Đoàn' },
  { value: '3', label: 'Quản trị tỉnh/thành Đoàn' },
  { value: '5', label: 'Giám khảo' },
  { value: '4', label: 'Thí sinh' },
]



const initialForm: CreateForm = {
  username: '',
  password: '',
  full_name: '',
  email: '',
  phone: '',
  school_name: '',
  work_unit: '',
  organization_position: '',
  role_id: '3',
}

const initialEditForm: EditForm = {
  full_name: '',
  email: '',
  phone: '',
  school_name: '',
  work_unit: '',
  organization_position: '',
  role_id: '4',
}

function normalizeError(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) return err.response?.data?.message || fallback
  return fallback
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function buildExportFilter(roleFilter: FilterRole) {
  if (roleFilter === 'ALL') return []

  const roleIdByFilter: Record<Exclude<FilterRole, 'ALL'>, number> = {
    TECH_ADMIN: 1,
    TW_ADMIN: 2,
    PROVINCE_ADMIN: 3,
    JUDGE: 5,
    CONTESTANT: 4,
  }

  return [{ key: 'role_id', value: roleIdByFilter[roleFilter] }]
}

function getExportFileName(roleFilter: FilterRole) {
  return roleFilter === 'ALL' ? 'users.xlsx' : `users-${roleFilter.toLowerCase()}.xlsx`
}

function roleDisplayName(roleCode: string | null) {
  switch (roleCode) {
    case 'TECH_ADMIN':
      return 'Quản trị kỹ thuật'
    case 'TW_ADMIN':
      return 'Quản trị trung ương Đoàn'
    case 'PROVINCE_ADMIN':
      return 'Quản trị tỉnh/thành Đoàn'
    case 'JUDGE':
      return 'Giám khảo'
    case 'CONTESTANT':
      return 'Thí sinh'
    default:
      return 'N/A'
  }
}

function buildEditForm(user: UserRow): EditForm {
  return {
    full_name: user.full_name || '',
    email: user.email || '',
    phone: user.phone || '',
    school_name: user.school_name || '',
    work_unit: user.work_unit || '',
    organization_position: user.organization_position || '',
    role_id: String(user.role_id || 4) as EditRole,
  }
}

export default function TwAdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<FilterRole>('ALL')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingUsername, setDeletingUsername] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<CreateForm>(initialForm)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editForm, setEditForm] = useState<EditForm>(initialEditForm)
  const [selectedProvince, setSelectedProvince] = useState<ProvinceOption | null>(null)
  const [selectedWard, setSelectedWard] = useState<WardOption | null>(null)
  const [editProvince, setEditProvince] = useState<ProvinceOption | null>(null)
  const [editWard, setEditWard] = useState<WardOption | null>(null)
  const [provinceLookup, setProvinceLookup] = useState<Record<number, string>>({})

  useEffect(() => {
    let cancelled = false
    async function loadProvinces() {
      try {
        const response = await fetch('https://provinces.open-api.vn/api/v2/p/')
        if (!response.ok) return
        const data = (await response.json()) as ProvinceOption[]
        if (cancelled) return
        const lookup = data.reduce<Record<number, string>>((result, province) => {
          result[province.code] = province.name
          return result
        }, {})
        setProvinceLookup(lookup)
      } catch {
        if (!cancelled) setProvinceLookup({})
      }
    }
    void loadProvinces()
    return () => {
      cancelled = true
    }
  }, [])

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
        [user.username, user.full_name, user.email, user.phone, user.province_name, user.ward_name, user.school_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized))
      return roleOk && queryOk
    })
  }, [users, query, roleFilter])

  const stats = useMemo(() => {
    const total = users.length
    const tech = users.filter((user) => user.role_code === 'TECH_ADMIN').length
    const tw = users.filter((user) => user.role_code === 'TW_ADMIN').length
    const province = users.filter((user) => user.role_code === 'PROVINCE_ADMIN').length
    const judge = users.filter((user) => user.role_code === 'JUDGE').length
    const contestant = users.filter((user) => user.role_code === 'CONTESTANT').length
    return { total, tech, tw, province, judge, contestant }
  }, [users])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pagedUsers = filteredUsers.slice(start, start + PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [query, roleFilter])

  async function handleCreateUser(event: FormEvent) {
    event.preventDefault()
    if (!selectedProvince || !selectedWard) {
      setError('Vui lòng chọn Tỉnh/Thành và Phường/Xã.')
      return
    }
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await api.post('/api/v1/auth/register', {
        ...form,
        role_id: Number(form.role_id),
        province_code: String(selectedProvince.code),
        province_name: selectedProvince.name,
        ward_name: selectedWard.name,
      })
      setMessage('Đã tạo tài khoản mới.')
      setForm(initialForm)
      setSelectedProvince(null)
      setSelectedWard(null)
      setCreateOpen(false)
      await loadUsers()
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không tạo được tài khoản.'))
    } finally {
      setSubmitting(false)
    }
  }

  function openEdit(user: UserRow) {
    if (user.role_code === 'TECH_ADMIN') return
    setEditUser(user)
    setEditForm(buildEditForm(user))
    if (user.province_code) {
      const code = Number(user.province_code)
      setEditProvince({ code, name: user.province_name || provinceLookup[code] || '' })
    } else {
      setEditProvince(null)
    }
    setEditWard(user.ward_name ? { code: 0, name: user.ward_name } : null)
    setEditOpen(true)
  }

  async function handleEditUser(event: FormEvent) {
    event.preventDefault()
    if (!editUser) return
    if (!editProvince || !editWard) {
      setError('Vui lòng chọn Tỉnh/Thành và Phường/Xã.')
      return
    }
    setSavingEdit(true)
    setError('')
    setMessage('')
    try {
      await api.put(`/api/v1/users/${encodeURIComponent(editUser.username)}`, {
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone,
        school_name: editForm.school_name,
        work_unit: editForm.work_unit,
        organization_position: editForm.organization_position,
        role_id: Number(editForm.role_id),
        province_code: String(editProvince.code),
        province_name: editProvince.name,
        ward_name: editWard.name,
      })
      setMessage('Đã cập nhật thông tin tài khoản.')
      setEditOpen(false)
      setEditUser(null)
      await loadUsers()
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không cập nhật được tài khoản.'))
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteUser(user: UserRow) {
    if (user.role_code === 'TECH_ADMIN') return
    if (!window.confirm(`Xóa tài khoản ${user.username}?`)) return
    setDeletingUsername(user.username)
    setError('')
    setMessage('')
    try {
      await api.delete(`/api/v1/users/${encodeURIComponent(user.username)}`)
      setMessage('Đã xóa tài khoản.')
      await loadUsers()
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không xóa được tài khoản.'))
    } finally {
      setDeletingUsername('')
    }
  }

  async function handleExportUsers() {
    setExporting(true)
    setError('')
    setMessage('')

    try {
      const response = await api.post(
        '/api/v1/export/users',
        { filter: buildExportFilter(roleFilter) },
        { responseType: 'blob' },
      )
      const contentType =
        typeof response.headers?.['content-type'] === 'string'
          ? response.headers['content-type']
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

      downloadBlob(
        new Blob([response.data], {
          type: contentType,
        }),
        getExportFileName(roleFilter),
      )
      setMessage('File Excel đã sẵn sàng và đang được tải xuống.')
    } catch (err: unknown) {
      setError(normalizeError(err, 'Không xuất được file user.'))
    } finally {
      setExporting(false)
    }
  }

  function closeCreateModal() {
    if (!submitting) setCreateOpen(false)
  }

  function closeEditModal() {
    if (!savingEdit) {
      setEditOpen(false)
      setEditUser(null)
    }
  }

  return (
    <main className="vb-page vb-dashboard-page vb-tw-users-page">
      <Navbar />
      <section className="vb-admin-hero vb-card vb-card-editorial">
        <div className="vb-admin-hero-copy">
          <p className="vb-overline">Điều hành trung ương</p>
          <h1>Quản lý người dùng</h1>
          <p className="vb-admin-lead">Quản lý tài khoản toàn hệ thống, trừ thao tác tạo/xóa/sửa với Quản trị kỹ thuật.</p>
        </div>
        <div className="vb-account-summary vb-account-summary-6">
          <div><span>Tổng tài khoản</span><strong>{stats.total}</strong></div>
          <div><span>Quản trị kỹ thuật</span><strong>{stats.tech}</strong></div>
          <div><span>Quản trị trung ương</span><strong>{stats.tw}</strong></div>
          <div><span>Quản trị tỉnh/thành</span><strong>{stats.province}</strong></div>
          <div><span>Giám khảo</span><strong>{stats.judge}</strong></div>
          <div><span>Thí sinh</span><strong>{stats.contestant}</strong></div>
        </div>
      </section>

      {error ? <section className="vb-account-banner is-error">{error}</section> : null}
      {message ? <section className="vb-account-banner">{message}</section> : null}
      {loading ? <section className="vb-account-banner">Đang tải dữ liệu...</section> : null}

      <section className="vb-season-panel">
        <div className="vb-section-head is-compact">
          <div>
            <p className="vb-overline">Danh sách</p>
            <h2>Tài khoản</h2>
          </div>
          <p className="vb-section-note">{filteredUsers.length} tài khoản khớp điều kiện hiện tại.</p>
        </div>

        <div className="vb-tw-toolbar-row">
          <div className="vb-account-search">
            <label htmlFor="tw-user-search">Tìm kiếm</label>
            <input id="tw-user-search" className="vb-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="username, họ tên, email, tỉnh, phường..." />
          </div>
          <div className="vb-tw-role-filter">
            <label htmlFor="tw-user-role">Vai trò</label>

            <select
              id="tw-user-role"
              className="vb-toolbar-select"
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value as FilterRole)
              }
            >
              {filterRoleOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="vb-tw-toolbar-cta">
            <button type="button" className="vb-tw-btn-primary" onClick={() => setCreateOpen(true)}>Tạo tài khoản</button>
            <button type="button" className="vb-tw-btn-muted" onClick={() => void handleExportUsers()} disabled={exporting}>
              {exporting ? 'Đang xuất...' : 'Xuất Excel'}
            </button>
          </div>
        </div>

        <div className="vb-account-table-wrap">
          <table className="vb-account-table">
            <thead>
              <tr>
                <th>Tài khoản</th>
                <th>Liên hệ</th>
                <th>Địa bàn</th>
                <th>Trường học</th>
                <th>Vai trò</th>
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
                  <td><span className="vb-role-pill">{roleDisplayName(user.role_code)}</span><span>{user.status || 'N/A'}</span></td>
                  <td>
                    {user.role_code === 'TECH_ADMIN' ? null : (
                      <div className="vb-tw-action-row">
                        <button type="button" className="vb-tw-btn-muted" onClick={() => openEdit(user)}>Chỉnh sửa</button>
                        <button type="button" className="vb-tw-btn-danger" onClick={() => void handleDeleteUser(user)}>
                          {deletingUsername === user.username ? 'Đang xóa...' : 'Xóa'}
                        </button>
                      </div>
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
      </section>

      {createOpen ? (
        <div className="vb-modal-backdrop" role="presentation" onClick={closeCreateModal}>
          <section className="vb-modal" role="dialog" aria-modal="true" aria-labelledby="tw-create-account-title" onClick={(event) => event.stopPropagation()}>
            <div className="vb-modal-head">
              <div>
                <p className="vb-overline">Tạo tài khoản mới</p>
                <h2 id="tw-create-account-title">Đăng ký tài khoản hệ thống</h2>
              </div>
              <button type="button" className="vb-modal-close" onClick={closeCreateModal}>Đóng</button>
            </div>
            <form className="vb-modal-body vb-modal-form" onSubmit={handleCreateUser}>
              <div className="vb-form-grid">
                <div className="vb-field"><input className="vb-input" placeholder=" " value={form.username} onChange={(e) => setForm((v) => ({ ...v, username: e.target.value }))} required /><label className="vb-float-label">Tên đăng nhập <span className="vb-required">*</span></label></div>
                <div className="vb-field"><input type="password" className="vb-input" placeholder=" " value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} required /><label className="vb-float-label">Mật khẩu <span className="vb-required">*</span></label></div>
                <div className="vb-field"><input className="vb-input" placeholder=" " value={form.full_name} onChange={(e) => setForm((v) => ({ ...v, full_name: e.target.value }))} required /><label className="vb-float-label">Họ và tên <span className="vb-required">*</span></label></div>
                <div className="vb-field"><input type="email" className="vb-input" placeholder=" " value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} required /><label className="vb-float-label">Email <span className="vb-required">*</span></label></div>
                <div className="vb-field"><input className="vb-input" placeholder=" " value={form.phone} onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))} /><label className="vb-float-label">Số điện thoại</label></div>
                <RoleSelector id="tw-role-create" label="Vai trò" value={form.role_id} onChange={(value) => setForm((v) => ({ ...v, role_id: value }))} options={createRoleOptions} required />
                <ProvinceSelector value={selectedProvince} onChange={(province) => { setSelectedProvince(province); setSelectedWard(null) }} />
                <WardSelector provinceCode={selectedProvince?.code ?? null} value={selectedWard} onChange={setSelectedWard} />
                <div className="vb-field"><input className="vb-input" placeholder=" " value={form.school_name} onChange={(e) => setForm((v) => ({ ...v, school_name: e.target.value }))} /><label className="vb-float-label">Trường học</label></div>
                <div className="vb-field"><input className="vb-input" placeholder=" " value={form.work_unit} onChange={(e) => setForm((v) => ({ ...v, work_unit: e.target.value }))} /><label className="vb-float-label">Đơn vị công tác</label></div>
                <div className="vb-field vb-full"><input className="vb-input" placeholder=" " value={form.organization_position} onChange={(e) => setForm((v) => ({ ...v, organization_position: e.target.value }))} /><label className="vb-float-label">Chức vụ Đoàn/Hội/Đội</label></div>
              </div>
              <div className="vb-modal-actions">
                <button type="submit" className="vb-tw-btn-primary" disabled={submitting}>{submitting ? 'Đang tạo...' : 'Tạo tài khoản'}</button>
                <button type="button" className="vb-tw-btn-muted" onClick={closeCreateModal}>Hủy</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {editOpen && editUser ? (
        <div className="vb-modal-backdrop" role="presentation" onClick={closeEditModal}>
          <section className="vb-modal" role="dialog" aria-modal="true" aria-labelledby="tw-edit-account-title" onClick={(event) => event.stopPropagation()}>
            <div className="vb-modal-head">
              <div>
                <p className="vb-overline">Chỉnh sửa tài khoản</p>
                <h2 id="tw-edit-account-title">{editUser.username}</h2>
              </div>
              <button type="button" className="vb-modal-close" onClick={closeEditModal}>Đóng</button>
            </div>
            <form className="vb-modal-body vb-modal-form" onSubmit={handleEditUser}>
              <div className="vb-form-grid">
                <div className="vb-field"><input className="vb-input" placeholder=" " value={editForm.full_name} onChange={(e) => setEditForm((v) => ({ ...v, full_name: e.target.value }))} required /><label className="vb-float-label">Họ và tên</label></div>
                <div className="vb-field"><input type="email" className="vb-input" placeholder=" " value={editForm.email} onChange={(e) => setEditForm((v) => ({ ...v, email: e.target.value }))} required /><label className="vb-float-label">Email</label></div>
                <div className="vb-field"><input className="vb-input" placeholder=" " value={editForm.phone} onChange={(e) => setEditForm((v) => ({ ...v, phone: e.target.value }))} /><label className="vb-float-label">Số điện thoại</label></div>
                <RoleSelector id="tw-role-edit" label="Vai trò" value={editForm.role_id} onChange={(value) => setEditForm((v) => ({ ...v, role_id: value }))} options={editRoleOptions} required />
                <ProvinceSelector value={editProvince} onChange={(province) => { setEditProvince(province); setEditWard(null) }} />
                <WardSelector provinceCode={editProvince?.code ?? null} value={editWard} onChange={setEditWard} />
                <div className="vb-field"><input className="vb-input" placeholder=" " value={editForm.school_name} onChange={(e) => setEditForm((v) => ({ ...v, school_name: e.target.value }))} /><label className="vb-float-label">Trường học</label></div>
                <div className="vb-field"><input className="vb-input" placeholder=" " value={editForm.work_unit} onChange={(e) => setEditForm((v) => ({ ...v, work_unit: e.target.value }))} /><label className="vb-float-label">Đơn vị công tác</label></div>
                <div className="vb-field vb-full"><input className="vb-input" placeholder=" " value={editForm.organization_position} onChange={(e) => setEditForm((v) => ({ ...v, organization_position: e.target.value }))} /><label className="vb-float-label">Chức vụ Đoàn/Hội/Đội</label></div>
              </div>
              <div className="vb-modal-actions">
                <button type="submit" className="vb-tw-btn-primary" disabled={savingEdit}>{savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
                <button type="button" className="vb-tw-btn-muted" onClick={closeEditModal}>Hủy</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  )
}
