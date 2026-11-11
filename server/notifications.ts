import type { Submission } from '../src/domain'
import { serverConfig } from './config'

export async function notifyNewSubmission(submission: Submission) {
  const url = serverConfig.notificationWebhookUrl
  if (!url) return { sent: false, reason: 'not-configured' as const }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'submission.created',
      submission: {
        id: submission.id,
        type: submission.type,
        title: submission.title,
        author: submission.author,
        status: submission.status,
        createdAt: new Date().toISOString(),
      },
    }),
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error(`Submission notification failed with HTTP ${response.status}`)
  return { sent: true as const }
}
