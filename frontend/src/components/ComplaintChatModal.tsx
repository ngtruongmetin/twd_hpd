import axios from 'axios'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { api } from '../api/api'
import {
  complaintStatusClass,
  complaintStatusLabel,
  type ComplaintStatus,
} from './complaintStatus'

export type ComplaintSummary = {
  submission_id: number
  complaint_status: ComplaintStatus
  message_count: number
  last_message_at: string | null
  last_sender_user_id: number | null
  last_sender_full_name: string | null
  last_sender_username: string | null
  last_sender_role: string | null
  last_sender_role_name: string | null
}

type ComplaintMessage = {
  id: number
  thread_id: number
  sender_user_id: number
  message: string
  created_at: string
  sender_full_name: string | null
  sender_username: string | null
  sender_role: string
  sender_role_name: string | null
}

type ComplaintDetail = {
  submission: {
    id: number
    title: string
    submitted_by_user_id: number
    competition_table_id: number | null
    author_full_name: string | null
    current_vote_points: number | string
  }
  complaint_status: ComplaintStatus
  messages: ComplaintMessage[]
}

type ComplaintChatModalProps = {
  submissionId: number
  submissionTitle?: string | null
  currentUserId?: number
  currentUserRole?: string
  onClose: () => void
  onStatusChange?: (submissionId: number, status: ComplaintStatus) => void
}

function normalizeError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) return error.response?.data?.message || fallback
  return fallback
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'N/A'

  // SQLite CURRENT_TIMESTAMP is UTC but is returned without a timezone marker.
  // Mark that shape explicitly so browsers do not interpret it as local time.
  const normalizedValue = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value
  const date = new Date(normalizedValue)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatPoints(value: number | string | null | undefined) {
  const points = Number(value)
  return Number.isFinite(points) ? points.toFixed(2) : '0.00'
}

export default function ComplaintChatModal({
  submissionId,
  submissionTitle,
  currentUserId,
  currentUserRole,
  onClose,
  onStatusChange,
}: ComplaintChatModalProps) {
  const [detail, setDetail] = useState<ComplaintDetail | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const onStatusChangeRef = useRef(onStatusChange)

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  useEffect(() => {
    let active = true

    async function loadDetail() {
      setLoading(true)
      setError('')
      try {
        const response = await api.get(`/api/v1/complaints/submissions/${submissionId}`)
        if (!active) return
        const nextDetail = response.data?.data as ComplaintDetail
        setDetail(nextDetail)
        onStatusChangeRef.current?.(submissionId, nextDetail.complaint_status)
      } catch (requestError: unknown) {
        if (active) setError(normalizeError(requestError, 'Không tải được hội thoại khiếu nại.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDetail()
    return () => {
      active = false
    }
  }, [submissionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [detail?.messages.length, loading])

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault()
    const trimmedMessage = message.trim()
    if (!trimmedMessage || sending) return

    setSending(true)
    setError('')
    try {
      const response = await api.post(`/api/v1/complaints/submissions/${submissionId}/messages`, {
        message: trimmedMessage,
      })
      const nextDetail = response.data?.data as ComplaintDetail
      setDetail(nextDetail)
      setMessage('')
      onStatusChangeRef.current?.(submissionId, nextDetail.complaint_status)
    } catch (requestError: unknown) {
      setError(normalizeError(requestError, 'Không gửi được tin nhắn khiếu nại.'))
    } finally {
      setSending(false)
    }
  }

  function handleMessageKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    void handleSubmit()
  }

  const title = detail?.submission.title || submissionTitle || `Bài thi #${submissionId}`
  const status = detail?.complaint_status || 'NOT_STARTED'
  const isStaffResponder = currentUserRole === 'TW_ADMIN' || currentUserRole === 'JUDGE'
  const canSendMessage = Boolean(
    detail &&
    (isStaffResponder
      ? detail.messages.length > 0
      : Number(detail.submission.submitted_by_user_id) === Number(currentUserId)),
  )

  return (
    <div className="vb-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="vb-modal vb-complaint-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="complaint-chat-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="vb-modal-head vb-complaint-head">
          <div>
            <p className="vb-overline">Khiếu nại điểm bình chọn</p>
            <h2 id="complaint-chat-title">{title}</h2>
            <div className="vb-complaint-meta">
              <span>Điểm bình chọn: <strong>{formatPoints(detail?.submission.current_vote_points)}</strong></span>
              <span className={`vb-status-pill ${complaintStatusClass(status)}`}>{complaintStatusLabel(status)}</span>
            </div>
          </div>
          <button type="button" className="vb-modal-close" onClick={onClose}>
            Đóng
          </button>
        </div>

        <div className="vb-complaint-chat" aria-live="polite">
          {loading ? <p className="vb-complaint-empty">Đang tải hội thoại...</p> : null}
          {!loading && !error && detail?.messages.length === 0 ? (
            <p className="vb-complaint-empty">
              {!isStaffResponder
                ? 'Chưa có tin nhắn. Hãy gửi nội dung khiếu nại của bạn.'
                : 'Chưa có ticket khiếu nại từ thí sinh.'}
            </p>
          ) : null}
          {!loading && !error
            ? detail?.messages.map((item) => {
              const isMine = Number(item.sender_user_id) === Number(currentUserId)
              return (
                <article key={item.id} className={`vb-complaint-message ${isMine ? 'is-mine' : 'is-theirs'}`}>
                  <div className="vb-complaint-message-author">
                    <strong>{item.sender_full_name || item.sender_username || 'Người dùng'}</strong>
                    <span>{item.sender_role_name || item.sender_role} · {formatDate(item.created_at)}</span>
                  </div>
                  <p>{item.message}</p>
                </article>
              )
            })
            : null}
          {error ? <p className="vb-account-banner is-error">{error}</p> : null}
          <div ref={messagesEndRef} />
        </div>

        <form className="vb-complaint-composer" onSubmit={(event) => void handleSubmit(event)}>
          <textarea
            className="vb-input vb-textarea"
            rows={3}
            maxLength={2000}
            placeholder={isStaffResponder ? 'Nhập phản hồi khiếu nại...' : 'Nhập nội dung khiếu nại...'}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={handleMessageKeyDown}
            disabled={loading || sending || !canSendMessage}
          />
          <div className="vb-complaint-composer-footer">
            <span>{message.length}/2000</span>
            <button
              type="submit"
              className="vb-btn vb-btn-primary"
              disabled={loading || sending || !canSendMessage || !message.trim()}
            >
              {sending ? 'Đang gửi...' : isStaffResponder ? 'Gửi phản hồi' : 'Gửi khiếu nại'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
