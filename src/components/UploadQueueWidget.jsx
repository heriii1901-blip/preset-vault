import { useUploadQueue } from '../context/UploadQueueContext'

const RADIUS = 15
const CIRC = 2 * Math.PI * RADIUS

export function UploadQueueWidget() {
  const { jobs } = useUploadQueue() || {}

  if (!jobs || jobs.length === 0) return null

  return (
    <div className="upload-queue-widget">
      {jobs.map((job) => {
        const offset = CIRC - (Math.min(job.progress, 100) / 100) * CIRC
        const icon = job.status === 'done' ? '✓' : job.status === 'error' ? '×' : '↑'
        return (
          <div key={job.id} className={`upload-queue-tab upload-queue-${job.status}`} title={job.stage}>
            <svg width="34" height="34" viewBox="0 0 34 34">
              <circle cx="17" cy="17" r={RADIUS} className="upload-ring-bg" />
              <circle
                cx="17"
                cy="17"
                r={RADIUS}
                className="upload-ring-fg"
                strokeDasharray={CIRC}
                strokeDashoffset={offset}
              />
            </svg>
            <span className="upload-queue-icon">{icon}</span>
          </div>
        )
      })}
    </div>
  )
}
