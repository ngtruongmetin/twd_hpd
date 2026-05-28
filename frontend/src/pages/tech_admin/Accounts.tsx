import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import Navbar from '../../components/Navbar'
import { api } from '../../api/api'

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
type AccountTab = 'overview' | 'contact' | 'organization' | 'audit'

const roleOptions: { label: string; value: FilterRole }[] = [
  { label: 'Tất cả role', value: 'ALL' },
  { label: 'TECH_ADMIN', value: 'TECH_ADMIN' },
  { label: 'TW_ADMIN', value: 'TW_ADMIN' },
  { label: 'PROVINCE_ADMIN', value: 'PROVINCE_ADMIN' },
  { label: 'JUDGE', value: 'JUDGE' },
  { label: 'CONTESTANT', value: 'CONTESTANT' },
]

const statusOptions: { label: string; value: FilterStatus }[] = [
  { label: 'Tất cả trạng thái', value: 'ALL' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' },
  { label: 'LOCKED', value: 'LOCKED' },
]

const tabOptions: { id: AccountTab; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'contact', label: 'Liên hệ' },
  { id: 'organization', label: 'Đơn vị' },
  { id: 'audit', label: 'Audit' },
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

export default function Accounts() {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<FilterRole>('ALL')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<AccountTab>('overview')
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    let active = true

    async function loadAccounts() {
      setLoading(true)
      setError('')
      try {
        const response = await api.get('/api/v1/users')
        if (!active) return
        const rows = (response.data?.data ?? []) as AccountRow[]
        setAccounts(rows)
        setSelectedId((current) => current ?? rows[0]?.id ?? null)
      } catch (err: unknown) {
        if (!active) return
        const message = axios.isAxiosError(err)
          ? err.response?.data?.message || 'Không tải được danh sách tài khoản.'
          : 'Không tải được danh sách tài khoản.'
        setError(message)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadAccounts()

    return () => {
      active = false
    }
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
    setActiveTab('overview')
    setDetailOpen(true)
  }

  function closeDetail() {
    setDetailOpen(false)
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
            trạng thái và thông tin hồ sơ của người dùng.
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
              <li>Dữ liệu đến từ API <code>GET /api/v1/users</code>.</li>
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
                <p className="vb-overline">Chi tiết tài khoản</p>
                <h2 id="account-modal-title">{selectedAccount.full_name}</h2>
                <p className="vb-modal-sub">{selectedAccount.username}</p>
              </div>
              <button type="button" className="vb-modal-close" onClick={closeDetail}>
                Đóng
              </button>
            </div>

            <div className="vb-tab-list" role="tablist" aria-label="Thông tin tài khoản">
              {tabOptions.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`vb-tab ${activeTab === tab.id ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="vb-modal-body">
              {activeTab === 'overview' ? (
                <div className="vb-modal-grid">
                  <div><span>Role</span><strong>{formatFallback(selectedAccount.role_code)}</strong></div>
                  <div><span>Trạng thái</span><strong>{formatFallback(selectedAccount.status)}</strong></div>
                  <div><span>Email</span><strong>{formatFallback(selectedAccount.email)}</strong></div>
                  <div><span>Phone</span><strong>{formatFallback(selectedAccount.phone)}</strong></div>
                </div>
              ) : null}

              {activeTab === 'contact' ? (
                <div className="vb-modal-grid">
                  <div><span>Email</span><strong>{formatFallback(selectedAccount.email)}</strong></div>
                  <div><span>SĐT</span><strong>{formatFallback(selectedAccount.phone)}</strong></div>
                  <div><span>Phường/Xã</span><strong>{formatFallback(selectedAccount.ward_name)}</strong></div>
                  <div><span>Tỉnh/Thành</span><strong>{formatFallback(selectedAccount.province_name)}</strong></div>
                </div>
              ) : null}

              {activeTab === 'organization' ? (
                <div className="vb-modal-grid">
                  <div><span>Trường/Đơn vị</span><strong>{formatFallback(selectedAccount.school_name || selectedAccount.work_unit)}</strong></div>
                  <div><span>Chức vụ</span><strong>{formatFallback(selectedAccount.organization_position)}</strong></div>
                  <div><span>Account source</span><strong>{formatFallback(selectedAccount.account_source)}</strong></div>
                  <div><span>Created by</span><strong>{formatFallback(selectedAccount.created_by)}</strong></div>
                </div>
              ) : null}

              {activeTab === 'audit' ? (
                <div className="vb-modal-grid">
                  <div><span>Created at</span><strong>{formatDate(selectedAccount.created_at)}</strong></div>
                  <div><span>Updated at</span><strong>{formatDate(selectedAccount.updated_at)}</strong></div>
                  <div><span>Email verified</span><strong>{formatDate(selectedAccount.email_verified_at)}</strong></div>
                  <div><span>Province code</span><strong>{formatFallback(selectedAccount.province_code)}</strong></div>
                </div>
              ) : null}
            </div>

            <div className="vb-modal-actions">
              <button type="button" className="vb-btn vb-btn-secondary">
                Khóa tài khoản
              </button>
              <button type="button" className="vb-btn vb-btn-primary">
                Chỉnh sửa hồ sơ
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
