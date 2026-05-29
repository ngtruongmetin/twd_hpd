import axios from 'axios'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Navbar from '../../components/Navbar'
import { api } from '../../api/api'
import ProvinceSelector, { type ProvinceOption } from '../../components/ProvinceSelector'
import WardSelector, { type WardOption } from '../../components/WardSelector'

type AccountRow = {
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
  role_name: string | null
  account_source: string | null
  status: string | null
  email_verified_at: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

type FilterRole = 'ALL' | 'TECH_ADMIN' | 'TW_ADMIN' | 'PROVINCE_ADMIN' | 'JUDGE' | 'CONTESTANT'
type FilterStatus = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'LOCKED'

type AccountForm = {
  username: string
  full_name: string
  email: string
  phone: string
  school_name: string
  work_unit: string
  organization_position: string
  role_id: string
  status: FilterStatus
}

const roleOptions: { label: string; value: FilterRole }[] = [
  { label: 'Tất cả role', value: 'ALL' },
  { label: 'TECH_ADMIN', value: 'TECH_ADMIN' },
  { label: 'TW_ADMIN', value: 'TW_ADMIN' },
  { label: 'PROVINCE_ADMIN', value: 'PROVINCE_ADMIN' },
  { label: 'JUDGE', value: 'JUDGE' },
  { label: 'CONTESTANT', value: 'CONTESTANT' },
]

const roleIdOptions: { label: string; value: string }[] = [
  { label: 'TECH_ADMIN', value: '1' },
  { label: 'TW_ADMIN', value: '2' },
  { label: 'PROVINCE_ADMIN', value: '3' },
  { label: 'CONTESTANT', value: '4' },
  { label: 'JUDGE', value: '5' },
]

const statusOptions: { label: string; value: FilterStatus }[] = [
  { label: 'Tất cả trạng thái', value: 'ALL' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' },
  { label: 'LOCKED', value: 'LOCKED' },
]

function formatDate(value: string | null) {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatFallback(value: string | null) {
  return value || 'N/A'
}

function buildForm(account: AccountRow | null): AccountForm {
  return {
    username: account?.username || '',
    full_name: account?.full_name || '',
    email: account?.email || '',
    phone: account?.phone || '',
    school_name: account?.school_name || '',
    work_unit: account?.work_unit || '',
    organization_position: account?.organization_position || '',
    role_id: String(account?.role_id || 4),
    status: (account?.status as FilterStatus) || 'ACTIVE',
  }
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<FilterRole>('ALL')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [form, setForm] = useState<AccountForm>(buildForm(null))
  const [selectedProvince, setSelectedProvince] = useState<ProvinceOption | null>(null)
  const [selectedWard, setSelectedWard] = useState<WardOption | null>(null)

  async function loadAccounts(selectUsername?: string) {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/api/v1/users')
      const rows = (response.data?.data ?? []) as AccountRow[]
      setAccounts(rows)

      const selectedRow =
        (selectUsername ? rows.find((row) => row.username === selectUsername) : null) ||
        rows.find((row) => row.id === selectedId) ||
        rows[0] ||
        null

      setSelectedId(selectedRow?.id ?? null)
      if (selectedRow) {
        setForm(buildForm(selectedRow))
        setSelectedProvince(
          selectedRow.province_code
            ? {
              code: Number(selectedRow.province_code),
              name: selectedRow.province_name || '',
            }
            : null,
        )
        setSelectedWard(
          selectedRow.ward_name
            ? {
              code: 0,
              name: selectedRow.ward_name,
            }
            : null,
        )
      }
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message || 'Không tải được danh sách tài khoản.'
        : 'Không tải được danh sách tài khoản.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAccounts()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDetailOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const filteredAccounts = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return accounts.filter((account) => {
      const matchesQuery =
        !normalized ||
        [account.username, account.full_name, account.email, account.province_name, account.school_name, account.work_unit]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalized))

      const matchesRole = roleFilter === 'ALL' || account.role_code === roleFilter
      const matchesStatus = statusFilter === 'ALL' || account.status === statusFilter

      return matchesQuery && matchesRole && matchesStatus
    })
  }, [accounts, query, roleFilter, statusFilter])

  const selectedAccount = filteredAccounts.find((account) => account.id === selectedId) || filteredAccounts[0] || null

  const stats = useMemo(() => {
    const total = accounts.length
    const activeCount = accounts.filter((account) => account.status === 'ACTIVE').length
    const adminCount = accounts.filter((account) => ['TECH_ADMIN', 'TW_ADMIN', 'PROVINCE_ADMIN'].includes(account.role_code || '')).length
    const judgeCount = accounts.filter((account) => account.role_code === 'JUDGE').length

    return { total, activeCount, adminCount, judgeCount }
  }, [accounts])

  function openDetail(account: AccountRow) {
    setSelectedId(account.id)
    setForm(buildForm(account))
    setSelectedProvince(
      account.province_code
        ? {
          code: Number(account.province_code),
          name: account.province_name || '',
        }
        : null,
    )
    setSelectedWard(
      account.ward_name
        ? {
          code: 0,
          name: account.ward_name,
        }
        : null,
    )
    setSaveError('')
    setSaveSuccess('')
    setDetailOpen(true)
  }

  function closeDetail() {
    setDetailOpen(false)
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!selectedAccount) {
      return
    }

    setSaving(true)
    setSaveError('')
    setSaveSuccess('')

    const payload = {
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      province_code: selectedProvince?.code != null ? String(selectedProvince.code) : null,
      province_name: selectedProvince?.name || null,
      ward_name: selectedWard?.name || null,
      school_name: form.school_name || null,
      work_unit: form.work_unit || null,
      organization_position: form.organization_position || null,
      role_id: Number(form.role_id),
      status: form.status,
    }

    try {
      await api.put(`/api/v1/users/${encodeURIComponent(selectedAccount.username)}`, payload)
      setSaveSuccess('Cập nhật thông tin thành công.')
      await loadAccounts(selectedAccount.username)
      setDetailOpen(true)
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message || 'Không cập nhật được tài khoản.'
        : 'Không cập nhật được tài khoản.'
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="vb-page vb-dashboard-page vb-account-page">
      <Navbar />

      <section className="vb-account-hero vb-card vb-card-editorial">
        <div>
          <p className="vb-overline">Quản lý tài khoản</p>
          <h1>Danh sách người dùng</h1>
          <p className="vb-account-lead">
            Trang này lấy dữ liệu từ <code>/api/v1/users</code>, dùng để tra cứu tài khoản, kiểm soát role,
            trạng thái và chỉnh sửa hồ sơ trực tiếp trong popup.
          </p>
        </div>

        <div className="vb-account-summary">
          <div>
            <span>Tổng tài khoản</span>
            <strong>{stats.total}</strong>
          </div>
          <div>
            <span>Đang hoạt động</span>
            <strong>{stats.activeCount}</strong>
          </div>
          <div>
            <span>Nhóm admin</span>
            <strong>{stats.adminCount}</strong>
          </div>
          <div>
            <span>Giám khảo</span>
            <strong>{stats.judgeCount}</strong>
          </div>
        </div>
      </section>

      <section className="vb-account-toolbar">
        <div className="vb-account-search">
          <label htmlFor="account-search">Tìm tài khoản</label>
          <input
            id="account-search"
            className="vb-input"
            placeholder="username, họ tên, email, tỉnh, đơn vị..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="vb-account-filters">
          <div>
            <label htmlFor="role-filter">Role</label>
            <select
              id="role-filter"
              className="vb-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as FilterRole)}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="status-filter">Trạng thái</label>
            <select
              id="status-filter"
              className="vb-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {error ? <section className="vb-account-banner is-error">{error}</section> : null}
      {loading ? <section className="vb-account-banner">Đang tải danh sách tài khoản...</section> : null}

      <section className="vb-account-workbench">
        <article className="vb-account-table-card">
          <div className="vb-section-head is-compact">
            <div>
              <p className="vb-overline">Danh sách</p>
              <h2>Kết quả lọc</h2>
            </div>
            <p className="vb-section-note">{filteredAccounts.length} tài khoản khớp điều kiện hiện tại.</p>
          </div>

          <div className="vb-account-table-wrap">
            <table className="vb-account-table">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Role</th>
                  <th>Trạng thái</th>
                  <th>Hồ sơ</th>

                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => (
                  <tr
                    key={account.id}
                    className={selectedAccount?.id === account.id ? 'is-selected' : ''}
                    onClick={() => openDetail(account)}
                  >
                    <td>
                      <strong>{account.username}</strong>
                      <span>{account.full_name}</span>
                    </td>
                    <td className="vb-table-cell-middle">
                      <div className="vb-table-cell-stack">
                        <span className="vb-role-pill">{account.role_code || 'UNKNOWN'}</span>
                        <span className="vb-cell-sub">{account.role_name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="vb-table-cell-middle">
                      <div className="vb-table-cell-stack is-center">
                        <span className={`vb-status-pill is-${(account.status || 'unknown').toLowerCase()}`}>
                          {account.status || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span>{account.province_name || 'N/A'}</span>
                      <span className="vb-cell-sub">{account.school_name || account.work_unit || 'N/A'}</span>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="vb-account-side">
          <article className="vb-account-note-card">
            <p className="vb-overline">Ghi chú vận hành</p>
            <ul>
              <li>Popup này có form chỉnh sửa trực tiếp và gọi API PUT.</li>
            </ul>
          </article>
        </aside>
      </section>

      {detailOpen && selectedAccount ? (
        <div className="vb-modal-backdrop" role="presentation" onClick={closeDetail}>
          <section
            className="vb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="vb-modal-head">
              <div>
                <p className="vb-overline">Chỉnh sửa tài khoản</p>
                <h2 id="account-modal-title">{selectedAccount.full_name}</h2>
                <p className="vb-modal-sub">{selectedAccount.username}</p>
              </div>
              <button type="button" className="vb-modal-close" onClick={closeDetail}>
                Đóng
              </button>
            </div>

            <div className="vb-modal-layout">
              <div className="vb-modal-main">
                {saveError ? <p className="vb-form-error">{saveError}</p> : null}
                {saveSuccess ? <p className="vb-form-success">{saveSuccess}</p> : null}

                <form className="vb-modal-form" onSubmit={handleSave}>
                  <section className="vb-modal-section">
                    <div className="vb-modal-section-head">
                      <div>
                        <p className="vb-overline">Thông tin chung</p>
                        <h3>Hồ sơ và quyền truy cập</h3>
                      </div>
                    </div>

                    <div className="vb-form-grid">
                      <div className="vb-field">
                        <input
                          id="username"
                          className="vb-input"
                          placeholder=" "
                          value={form.username}
                          disabled
                        />
                        <label className="vb-float-label" htmlFor="username">Username</label>
                      </div>
                      <div className="vb-field">
                        <input
                          id="full_name"
                          className="vb-input"
                          placeholder=" "
                          value={form.full_name}
                          onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                          required
                        />
                        <label className="vb-float-label" htmlFor="full_name">Họ và tên</label>
                      </div>
                      <div className="vb-field">
                        <input
                          id="email"
                          type="email"
                          className="vb-input"
                          placeholder=" "
                          value={form.email}
                          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                          required
                        />
                        <label className="vb-float-label" htmlFor="email">Email</label>
                      </div>
                      <div className="vb-field">
                        <input
                          id="phone"
                          className="vb-input"
                          placeholder=" "
                          value={form.phone}
                          onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                        />
                        <label className="vb-float-label" htmlFor="phone">Số điện thoại</label>
                      </div>
                      <div className="vb-field">
                        <label className="vb-label" htmlFor="role_id">Vai trò</label>
                        <select
                          id="role_id"
                          className="vb-select"
                          value={form.role_id}
                          onChange={(e) => setForm((prev) => ({ ...prev, role_id: e.target.value }))}
                        >
                          {roleIdOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="vb-field">
                        <label className="vb-label" htmlFor="status">Trạng thái</label>
                        <select
                          id="status"
                          className="vb-select"
                          value={form.status}
                          onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as FilterStatus }))}
                        >
                          {statusOptions.filter((option) => option.value !== 'ALL').map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>

                  <section className="vb-modal-section">
                    <div className="vb-modal-section-head">
                      <div>
                        <p className="vb-overline">Địa bàn</p>
                        <h3>Tỉnh, phường và phạm vi quản lý</h3>
                      </div>
                    </div>

                    <div className="vb-form-grid">
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
                    </div>
                  </section>

                  <section className="vb-modal-section">
                    <div className="vb-modal-section-head">
                      <div>
                        <p className="vb-overline">Đơn vị</p>
                        <h3>Trường học và tổ chức</h3>
                      </div>
                    </div>

                    <div className="vb-form-grid">
                      <div className="vb-field">
                        <input
                          id="school_name"
                          className="vb-input"
                          placeholder=" "
                          value={form.school_name}
                          onChange={(e) => setForm((prev) => ({ ...prev, school_name: e.target.value }))}
                        />
                        <label className="vb-float-label" htmlFor="school_name">Trường học</label>
                      </div>
                      <div className="vb-field">
                        <input
                          id="work_unit"
                          className="vb-input"
                          placeholder=" "
                          value={form.work_unit}
                          onChange={(e) => setForm((prev) => ({ ...prev, work_unit: e.target.value }))}
                        />
                        <label className="vb-float-label" htmlFor="work_unit">Đơn vị công tác</label>
                      </div>
                      <div className="vb-field vb-full">
                        <input
                          id="organization_position"
                          className="vb-input"
                          placeholder=" "
                          value={form.organization_position}
                          onChange={(e) => setForm((prev) => ({ ...prev, organization_position: e.target.value }))}
                        />
                        <label className="vb-float-label" htmlFor="organization_position">Chức vụ Đoàn/Hội/Đội</label>
                      </div>
                    </div>
                  </section>

                  <section className="vb-modal-section">
                    <div className="vb-modal-section-head">
                      <div>
                        <p className="vb-overline">Audit</p>
                        <h3>Thông tin hệ thống</h3>
                      </div>
                    </div>

                    <div className="vb-form-grid">
                      <div className="vb-field">
                        <input id="account_source" className="vb-input" placeholder=" " value={formatFallback(selectedAccount.account_source)} disabled />
                        <label className="vb-float-label" htmlFor="account_source">Nguồn tài khoản</label>
                      </div>
                      <div className="vb-field">
                        <input id="created_by" className="vb-input" placeholder=" " value={formatFallback(selectedAccount.created_by)} disabled />
                        <label className="vb-float-label" htmlFor="created_by">Tạo bởi</label>
                      </div>
                      <div className="vb-field">
                        <input id="email_verified_at" className="vb-input" placeholder=" " value={formatDate(selectedAccount.email_verified_at)} disabled />
                        <label className="vb-float-label" htmlFor="email_verified_at">Email verified</label>
                      </div>
                      <div className="vb-field">
                        <input id="updated_at" className="vb-input" placeholder=" " value={formatDate(selectedAccount.updated_at)} disabled />
                        <label className="vb-float-label" htmlFor="updated_at">Cập nhật cuối</label>
                      </div>
                    </div>
                  </section>

                  <div className="vb-modal-actions">
                    <button type="submit" className="vb-btn vb-btn-primary" disabled={saving}>
                      {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                    <button type="button" className="vb-btn vb-btn-secondary" onClick={closeDetail}>
                      Hủy
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
