export type RoleCode = 'TECH_ADMIN' | 'TW_ADMIN' | 'PROVINCE_ADMIN' | 'JUDGE' | 'CONTESTANT'

export type SessionUser = {
  id?: number
  username: string
  full_name?: string
  role_code?: string
  role_name?: string
}

const dashboardPathByRole: Record<RoleCode, string> = {
  TECH_ADMIN: '/dashboard/tech_admin',
  TW_ADMIN: '/dashboard/tw_admin',
  PROVINCE_ADMIN: '/dashboard/province_admin',
  JUDGE: '/dashboard/judge',
  CONTESTANT: '/dashboard/contestant',
}

const dashboardTitleByRole: Record<RoleCode, string> = {
  TECH_ADMIN: 'Tech Admin Dashboard',
  TW_ADMIN: 'TW Admin Dashboard',
  PROVINCE_ADMIN: 'Province Admin Dashboard',
  JUDGE: 'Judge Dashboard',
  CONTESTANT: 'Contest Dashboard',
}

export function getDashboardPathForRole(roleCode?: string | null) {
  if (!roleCode) {
    return '/dashboard/contestant'
  }

  return dashboardPathByRole[roleCode as RoleCode] ?? '/dashboard/contestant'
}

export function getDashboardTitleForRole(roleCode?: string | null) {
  if (!roleCode) {
    return 'Contest Dashboard'
  }

  return dashboardTitleByRole[roleCode as RoleCode] ?? 'Contest Dashboard'
}
