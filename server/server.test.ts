import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.ADMIN_PASSWORD = 'test-admin-password-123456'
process.env.SESSION_SECRET = 'test-session-secret-123456789012345678901234'

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'houhui-journal-'))
const databasePath = path.join(tempDir, 'test.sqlite')
const { JournalDatabase } = await import('./database')
const { createApp } = await import('./app')
const database = new JournalDatabase(databasePath)
const app = createApp(database)
const server = app.listen(0)
await new Promise<void>(resolve => server.once('listening', resolve))
const address = server.address()
const baseUrl = typeof address === 'object' && address ? `http://127.0.0.1:${address.port}` : ''

const validSubmission = {
  type: 'analysis', title: '服务端测试稿', author: '测试笔名', email: 'author@example.com',
  summary: '测试摘要', body: '真实材料的测试正文', disciplines: ['心理学'], tags: '关系,测试',
  basis: '', note: '', references: '', episode: '', spoiler: false, rights: 'original',
  sourceAuthor: '', sourceUrl: '', authorization: '', aiUsage: 'none', aiDetail: '',
  consent: true, nonfiction: false,
}

async function json(pathname: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${pathname}`, init)
  return { response, body: await response.json() as Record<string, unknown> }
}

describe('server contracts', () => {
  afterAll(() => {
    server.close()
    database.close()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('keeps admin routes protected', async () => {
    const { response } = await json('/api/admin/submissions')
    expect(response.status).toBe(401)
  })

  it('persists an idempotent pending submission without exposing it publicly', async () => {
    const key = 'submission-test-key'
    const first = await json('/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(validSubmission) })
    const second = await json('/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(validSubmission) })
    expect(first.response.status).toBe(201)
    expect(second.response.status).toBe(200)
    expect((second.body.data as Record<string, unknown>).duplicate).toBe(true)
    const publicResults = await json('/api/works?q=服务端测试稿')
    expect(publicResults.body.data).toEqual([])
  })

  it('requires login, reviews the work, and then exposes only public fields', async () => {
    const login = await json('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }) })
    expect(login.response.status).toBe(200)
    const cookie = login.response.headers.get('set-cookie')?.split(';')[0]
    expect(cookie).toBeTruthy()
    const resumedDatabase = new JournalDatabase(databasePath)
    const resumedApp = createApp(resumedDatabase)
    const resumedServer = resumedApp.listen(0)
    await new Promise<void>(resolve => resumedServer.once('listening', resolve))
    const resumedAddress = resumedServer.address()
    const resumedBaseUrl = typeof resumedAddress === 'object' && resumedAddress ? `http://127.0.0.1:${resumedAddress.port}` : ''
    try {
      const resumedSession = await fetch(`${resumedBaseUrl}/api/admin/session`, { headers: { Cookie: cookie! } })
      expect(resumedSession.status).toBe(200)
    } finally {
      resumedServer.close()
      resumedDatabase.close()
    }
    const auditLogs = await json('/api/admin/audit-logs', { headers: { Cookie: cookie! } })
    expect(auditLogs.response.status).toBe(200)
    expect(auditLogs.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'admin.login' }),
      expect.objectContaining({ action: 'submission.created' }),
    ]))
    const pending = await json('/api/admin/submissions?status=pending', { headers: { Cookie: cookie! } })
    const submission = (pending.body.data as Array<Record<string, unknown>>).find(item => item.title === '服务端测试稿')
    expect(submission?.email).toBe('author@example.com')
    const review = await json(`/api/admin/submissions/${submission?.id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie! }, body: JSON.stringify({ approve: true }) })
    expect(review.response.status).toBe(200)
    const works = await json('/api/works?q=服务端测试稿')
    const published = (works.body.data as Array<Record<string, unknown>>)[0]
    expect(published.title).toBe('服务端测试稿')
    expect(published).not.toHaveProperty('email')
    expect(published).not.toHaveProperty('aiDetail')
    expect(published).not.toHaveProperty('authorization')
  })

  it('keeps comments pending until an admin approves them', async () => {
    const comment = await json('/api/works/sample-01/comments', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'comment-test-key' }, body: JSON.stringify({ nickname: '读者', body: '待审评论' }) })
    expect(comment.response.status).toBe(201)
    expect((await json('/api/works/sample-01/comments')).body.data).not.toContainEqual(expect.objectContaining({ body: '待审评论' }))
    const login = await json('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }) })
    const cookie = login.response.headers.get('set-cookie')?.split(';')[0]
    const adminComments = await json('/api/admin/comments', { headers: { Cookie: cookie! } })
    const pendingComment = (adminComments.body.data as Array<Record<string, unknown>>).find(item => item.body === '待审评论')
    await json(`/api/admin/comments/${pendingComment?.id}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie! }, body: JSON.stringify({ status: 'approved' }) })
    expect((await json('/api/works/sample-01/comments')).body.data).toContainEqual(expect.objectContaining({ body: '待审评论' }))
  })
})
