export type ComplaintStatus = 'NOT_STARTED' | 'PENDING' | 'RESPONDED'

export function complaintStatusLabel(status: ComplaintStatus) {
  if (status === 'PENDING') return 'Chưa xử lý'
  if (status === 'RESPONDED') return 'Đã phản hồi'
  return 'Chưa khiếu nại'
}

export function complaintStatusClass(status: ComplaintStatus) {
  if (status === 'PENDING') return 'is-pending'
  if (status === 'RESPONDED') return 'is-active'
  return 'is-inactive'
}
