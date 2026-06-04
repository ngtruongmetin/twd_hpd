export type RoleCode = 'TECH_ADMIN' | 'TW_ADMIN' | 'PROVINCE_ADMIN' | 'JUDGE' | 'CONTESTANT'

export type SessionUser = {
  id?: number
  username: string
  full_name?: string
  role_code?: string
  role_name?: string
  email?: string | null
  phone?: string | null
  province_code?: string | null
  province_name?: string | null
  ward_name?: string | null
  school_name?: string | null
  work_unit?: string | null
  organization_position?: string | null
  facebook_post_url?: string | null
  google_sub?: string | null
  profile_completed?: boolean | number | null
}

const dashboardPathByRole: Record<RoleCode, string> = {
  TECH_ADMIN: '/dashboard/tech_admin',
  TW_ADMIN: '/dashboard/tw_admin',
  PROVINCE_ADMIN: '/dashboard/province_admin',
  JUDGE: '/dashboard/judge',
  CONTESTANT: '/dashboard/contestant',
}

const dashboardTitleByRole: Record<RoleCode, string> = {
  TECH_ADMIN: 'Dashboard QTV kỹ thuật',
  TW_ADMIN: 'Dashboard BTC TW Đoàn',
  PROVINCE_ADMIN: 'Dashboard QTV tỉnh',
  JUDGE: 'Dashboard Giám khảo',
  CONTESTANT: 'Dashboard Thí sinh',
}

export function isProfileCompleted(profileCompleted?: boolean | number | null) {
  return !(profileCompleted === false || profileCompleted === 0 || profileCompleted === '0')
}

export function getDashboardPathForRole(roleCode?: string | null, profileCompleted?: boolean | number | null) {
  if (!roleCode) {
    return '/dashboard/contestant'
  }

  if (roleCode === 'CONTESTANT' && !isProfileCompleted(profileCompleted)) {
    return '/complete-profile'
  }

  return dashboardPathByRole[roleCode as RoleCode] ?? '/dashboard/contestant'
}

export function getDashboardTitleForRole(roleCode?: string | null) {
  if (!roleCode) {
    return 'Dashboard Thí sinh'
  }

  return dashboardTitleByRole[roleCode as RoleCode] ?? 'Dashboard Thí sinh'
}
