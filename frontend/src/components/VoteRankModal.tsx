import type { FormEvent } from 'react'

export type VoteRankSubmission = {
  id: number
  title: string
  author_full_name: string | null
  competition_table_id: number | null
}

type VoteRankModalProps = {
  open: boolean
  submission: VoteRankSubmission | null
  rankPosition: string
  onRankPositionChange: (value: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  saving: boolean
  error: string
}

const rankOptions = [
  { value: '0', label: 'Không xếp hạng' },
  { value: '1', label: 'Top 1 - 50 điểm' },
  { value: '2', label: 'Top 2 - 40 điểm' },
  { value: '3', label: 'Top 3 - 30 điểm' },
  { value: '4', label: 'Top 4 - 20 điểm' },
  { value: '5', label: 'Top 5 - 10 điểm' },
]

export default function VoteRankModal({
  open,
  submission,
  rankPosition,
  onRankPositionChange,
  onClose,
  onSubmit,
  saving,
  error,
}: VoteRankModalProps) {
  if (!open || !submission) return null

  return (
    <div className="vb-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="vb-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vote-rank-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="vb-modal-head">
          <div>
            <p className="vb-overline">Chấm điểm bình chọn</p>
            <h2 id="vote-rank-title">Chọn thứ hạng cho bài nộp</h2>
            <p className="vb-modal-sub">
              {submission.title}
            </p>
            <p className="vb-modal-description">
              Tác giả: {submission.author_full_name || 'N/A'}
            </p>
          </div>
          <button type="button" className="vb-modal-close" onClick={onClose}>
            Đóng
          </button>
        </div>

        <form className="vb-modal-body vb-modal-form" onSubmit={onSubmit}>
          <div className="vb-field vb-field-select">
            <label className="vb-field-label" htmlFor="vote-rank-position">
              Thứ hạng
            </label>
            <select
              id="vote-rank-position"
              className="vb-select"
              value={rankPosition}
              onChange={(event) => onRankPositionChange(event.target.value)}
              required
            >
              {rankOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="vb-form-error">{error}</p> : null}

          <div className="vb-modal-actions">
            <button type="button" className="vb-tw-btn-muted" onClick={onClose} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="vb-tw-btn-primary" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
