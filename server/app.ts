import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { disciplines, filterWorks, typeNames } from '../src/domain'
import type { Comment, Issue, SubmissionInput, Work } from '../src/domain'
import { serverConfig, assertProductionConfig } from './config'
import { JournalDatabase } from './database'
import { createAdminAuth, sessionCookieOptions, verifyPassword } from './auth'
import { notifyNewSubmission } from './notifications'
import { parseComment, parseIssue, parseSubmission, publicComment, publicIssue, publicWork, toSubmission } from './validation'

export function createApp(database = new JournalDatabase(), options: { serveFrontend?: boolean } = {}) {
  assertProductionConfig()
  const app = express()
  const serveFrontend = options.serveFrontend === true
  const frontendDist = path.resolve('dist')
  const { adminRequired, createSession, destroySession } = createAdminAuth(database)
  const audit = (actor: string, action: string, targetType: string, targetId: string, details: Record<string, unknown> = {}) => {
    database.recordAuditLog(actor, action, targetType, targetId, details, new Date().toISOString())
  }
  app.disable('x-powered-by')
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cookieParser(serverConfig.sessionSecret || 'local-development-cookie-secret'))
  app.use(express.json({ limit: '120kb' }))
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }))
  const publicLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 80, standardHeaders: 'draft-8', legacyHeaders: false })
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false })
  const submissionLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false })
  const commentLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false })

  app.get('/health', (_req, res) => res.json({ service: 'houhui-journal-api', status: 'ok' }))
  app.get('/', (_req, res, next) => {
    if (serveFrontend) return next()
    return res.json({
      service: 'houhui-journal-api',
      status: 'ok',
      frontend: 'http://127.0.0.1:5177/',
      publicApi: 'http://127.0.0.1:8787/api/site',
    })
  })

  app.get('/api/site', (_req, res) => res.json({ name: '后会有期刊', program: '后会友期', types: typeNames, disciplines, commentsOpen: true, free: true, advertising: false }))

  app.get('/api/works', publicLimiter, (req, res) => {
    const all = database.listWorks()
    const params = new URLSearchParams()
    for (const key of ['q', 'type', 'discipline', 'tag']) if (typeof req.query[key] === 'string') params.set(key, req.query[key] as string)
    const page = Math.max(1, Number(req.query.page) || 1)
    const pageSize = Math.min(50, Math.max(1, Number(req.query.page_size) || 20))
    const items = filterWorks(all, params)
    res.json({ data: items.slice((page - 1) * pageSize, page * pageSize).map(publicWork), meta: { page, pageSize, total: items.length, pageCount: Math.max(1, Math.ceil(items.length / pageSize)) } })
  })

  app.get('/api/works/:id', publicLimiter, (req, res) => {
    const id = String(req.params.id)
    const work = database.getWork(id)
    if (!work) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '作品不存在或尚未公开' } })
    return res.json({ data: publicWork(work), issues: database.listIssues().filter(issue => issue.workIds.includes(work.id)).map(issue => ({ id: issue.id, slug: issue.slug, number: issue.number, title: issue.title })) })
  })

  app.get('/api/works/:id/comments', publicLimiter, (req, res) => {
    const id = String(req.params.id)
    if (!database.getWork(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '作品不存在或尚未公开' } })
    const comments = database.listComments(id, true)
    return res.json({ data: comments.map(publicComment), meta: { total: comments.length } })
  })

  app.post('/api/works/:id/comments', publicLimiter, commentLimiter, (req, res) => {
    const id = String(req.params.id)
    if (!database.getWork(id)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '作品不存在或尚未公开' } })
    const parsed = parseComment(req.body)
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '评论内容未通过校验', fields: parsed.fields } })
    const requestKey = String(req.get('Idempotency-Key') || '').trim()
    if (!requestKey || requestKey.length > 100) return res.status(400).json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: '请提供有效的 Idempotency-Key' } })
    const existing = database.findCommentByRequestKey(requestKey)
    if (existing) return res.status(200).json({ data: { id: existing.id, status: existing.status === 'approved' ? 'approved' : 'pending', duplicate: true } })
    const now = new Date().toISOString()
    const comment: Comment = { id: randomUUID(), workId: id, nickname: parsed.data.nickname, body: parsed.data.body, status: 'pending' }
    database.insertComment(comment, requestKey, now)
    return res.status(201).json({ data: { id: comment.id, status: 'pending' } })
  })

  app.post('/api/submissions', publicLimiter, submissionLimiter, (req, res) => {
    const parsed = parseSubmission(req.body)
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '投稿内容未通过校验', fields: parsed.fields } })
    const requestKey = String(req.get('Idempotency-Key') || '').trim()
    if (!requestKey || requestKey.length > 100) return res.status(400).json({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: '请提供有效的 Idempotency-Key' } })
    const existing = database.findSubmissionByRequestKey(requestKey)
    if (existing) return res.status(200).json({ data: { id: existing.id, status: existing.status, duplicate: true } })
    const submission = toSubmission(parsed.data as SubmissionInput)
    const createdAt = new Date().toISOString()
    database.insertSubmission(submission, requestKey, createdAt)
    audit('public', 'submission.created', 'submission', submission.id, { type: submission.type, title: submission.title })
    void notifyNewSubmission(submission).catch(error => console.error(error))
    return res.status(201).json({ data: { id: submission.id, status: 'pending' } })
  })

  app.get('/api/issues', publicLimiter, (_req, res) => {
    const issues = database.listIssues()
    return res.json({ data: issues.map(issue => publicIssue(issue, database.listWorks())) })
  })

  app.get('/api/issues/:slug', publicLimiter, (req, res) => {
    const issue = database.getIssue(String(req.params.slug))
    if (!issue) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '期刊不存在或尚未公开' } })
    return res.json({ data: publicIssue(issue, database.listWorks()) })
  })

  app.post('/api/admin/login', authLimiter, (req, res) => {
    if (typeof req.body?.password !== 'string' || !verifyPassword(req.body.password)) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: '登录失败' } })
    const token = createSession()
    audit('admin', 'admin.login', 'admin', 'session')
    res.cookie('houhui_admin', token, sessionCookieOptions())
    return res.json({ data: { authenticated: true } })
  })
  app.post('/api/admin/logout', adminRequired, (req, res) => { audit('admin', 'admin.logout', 'admin', 'session'); destroySession(req); res.clearCookie('houhui_admin', sessionCookieOptions()); return res.status(204).end() })
  app.get('/api/admin/session', adminRequired, (_req, res) => res.json({ data: { authenticated: true } }))
  app.get('/api/admin/audit-logs', adminRequired, (req, res) => {
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100
    return res.json({ data: database.listAuditLogs(limit) })
  })

  app.get('/api/admin/submissions', adminRequired, (req, res) => res.json({ data: database.listSubmissions(typeof req.query.status === 'string' ? req.query.status : undefined) }))
  app.post('/api/admin/submissions/:id/review', adminRequired, (req, res) => {
    if (typeof req.body?.approve !== 'boolean') return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'approve 必须是布尔值' } })
    const id = String(req.params.id)
    const now = new Date().toISOString()
    const submission = database.reviewSubmission(id, req.body.approve, typeof req.body.reviewNote === 'string' ? req.body.reviewNote.slice(0, 1000) : '', now)
    if (!submission) return res.status(409).json({ error: { code: 'STATE_CONFLICT', message: '稿件不存在或已处理' } })
    audit('admin', req.body.approve ? 'submission.approved' : 'submission.rejected', 'submission', id, { reviewNote: submission.reviewNote || '' })
    return res.json({ data: { id: submission.id, status: submission.status } })
  })
  app.post('/api/admin/works/:id/withdraw', adminRequired, (req, res) => {
    const id = String(req.params.id)
    const work = database.withdrawWork(id, new Date().toISOString())
    if (!work) return res.status(409).json({ error: { code: 'STATE_CONFLICT', message: '作品不存在、未公开或已经撤下' } })
    audit('admin', 'work.withdrawn', 'work', id)
    return res.json({ data: { id: work.id, status: work.status } })
  })
  app.get('/api/admin/comments', adminRequired, (_req, res) => res.json({ data: database.listComments() }))
  app.post('/api/admin/comments/:id/review', adminRequired, (req, res) => {
    const status = req.body?.status
    if (!['approved', 'rejected', 'hidden'].includes(status)) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '评论状态不正确' } })
    const id = String(req.params.id)
    const comment = database.reviewComment(id, status, new Date().toISOString())
    if (!comment) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '评论不存在' } })
    audit('admin', `comment.${status}`, 'comment', id)
    return res.json({ data: { id: comment.id, status: comment.status } })
  })
  app.get('/api/admin/issues', adminRequired, (_req, res) => res.json({ data: database.listIssues(false) }))
  app.post('/api/admin/issues', adminRequired, (req, res) => {
    const parsed = parseIssue(req.body)
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '期刊内容未通过校验', fields: parsed.fields } })
    const workIds = [...new Set(parsed.data.workIds)].filter(id => Boolean(database.getWork(id)))
    if (workIds.length !== parsed.data.workIds.length) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '期刊包含不存在的作品' } })
    const now = new Date().toISOString()
    const issue: Issue = { id: parsed.data.id || randomUUID(), slug: parsed.data.slug, number: parsed.data.number, title: parsed.data.title, description: parsed.data.description, editorial: parsed.data.editorial, cover: parsed.data.cover, workIds, status: parsed.data.status, publishedAt: parsed.data.status === 'published' ? parsed.data.publishedAt || now : '', sample: false }
    try {
      const saved = database.saveIssue(issue, now)
      audit('admin', 'issue.saved', 'issue', saved.id, { status: saved.status, number: saved.number })
      return res.status(201).json({ data: saved })
    } catch { return res.status(409).json({ error: { code: 'STATE_CONFLICT', message: '期号或 slug 已存在' } }) }
  })

  if (serveFrontend) {
    app.use(express.static(frontendDist, { index: false }))
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        return res.sendFile(path.join(frontendDist, 'index.html'))
      }
      return next()
    })
  }
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: '接口不存在' } }))
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error)
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '服务暂时不可用' } })
  })
  return app
}
