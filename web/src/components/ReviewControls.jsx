import { useId, useState } from 'react'
import { useReview } from '../api/hooks.js'
import { ErrorMessage } from './Feedback.jsx'

export function ReviewControls({ movement, onDone }) {
  const review = useReview()
  const [remark, setRemark] = useState('')
  const remarkId = useId()

  const decide = (decision) =>
    review.mutate(
      { id: movement.id, review: decision, remark: remark || undefined },
      { onSuccess: () => { setRemark(''); onDone?.() } }
    )

  return (
    <div className="space-y-2">
      <div>
        <label htmlFor={remarkId} className="sr-only">Remark (optional)</label>
        <input
          id={remarkId}
          className="input"
          maxLength={300}
          placeholder="Remark (optional)"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={review.isPending || !movement.timeIn}
          title={movement.timeIn ? undefined : 'Correct the Time In first'}
          onClick={() => decide('confirmed')}
        >
          Confirm
        </button>
        <button type="button" className="btn-danger" disabled={review.isPending} onClick={() => decide('flagged')}>
          Flag
        </button>
      </div>
      <ErrorMessage error={review.error} />
    </div>
  )
}
