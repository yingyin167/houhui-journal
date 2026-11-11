import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { initialIssues, initialSubmissions, initialWorks } from '../src/data'
import type { Comment, Issue, Submission, Work } from '../src/domain'
import type { AuditLogRecord, CommentRecord, IssueRecord, SubmissionRecord, WorkRecord } from './types'
import { serverConfig } from './config'

type Row = Record<string, unknown>

const json = (value: unknown) => JSON.stringify(value ?? [])
const parseJson = <T>(value: unknown, fallback: T): T => {
  try { return JSON.parse(String(value)) as T } catch { return fallback }
}
const stringValue = (value: unknown) => String(value ?? '')
const boolValue = (value: unknown) => Number(value) === 1

export class JournalDatabase {
  readonly db: DatabaseSync

  constructor(databasePath = serverConfig.databasePath) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true })
    this.db = new DatabaseSync(databasePath)
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
    this.migrate()
    this.seed()
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
        title TEXT NOT NULL, author TEXT NOT NULL, email TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '', body TEXT NOT NULL, disciplines_json TEXT NOT NULL,
        tags_json TEXT NOT NULL, basis TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
        references_text TEXT NOT NULL DEFAULT '', episode TEXT NOT NULL DEFAULT '',
        spoiler INTEGER NOT NULL DEFAULT 0, ai_usage TEXT NOT NULL, ai_detail TEXT NOT NULL DEFAULT '',
        rights TEXT NOT NULL, source_author TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '',
        authorization TEXT NOT NULL DEFAULT '', consent INTEGER NOT NULL DEFAULT 0,
        nonfiction INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, review_note TEXT NOT NULL DEFAULT '',
        published_at TEXT NOT NULL DEFAULT '', sample INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS works (
        id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, author TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '', body TEXT NOT NULL, disciplines_json TEXT NOT NULL,
        tags_json TEXT NOT NULL, basis TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
        references_text TEXT NOT NULL DEFAULT '', episode TEXT NOT NULL DEFAULT '',
        spoiler INTEGER NOT NULL DEFAULT 0, ai_usage TEXT NOT NULL, rights TEXT NOT NULL,
        source_author TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL, published_at TEXT NOT NULL DEFAULT '', sample INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, work_id TEXT NOT NULL,
        nickname TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(work_id) REFERENCES works(id)
      );
      CREATE TABLE IF NOT EXISTS issues (
        id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, number TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL, description TEXT NOT NULL, editorial TEXT NOT NULL,
        cover TEXT NOT NULL, work_ids_json TEXT NOT NULL, status TEXT NOT NULL,
        published_at TEXT NOT NULL DEFAULT '', sample INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL,
        target_type TEXT NOT NULL, target_id TEXT NOT NULL, details_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS works_public_date ON works(status, published_at DESC);
      CREATE INDEX IF NOT EXISTS comments_work_status ON comments(work_id, status, created_at);
      CREATE INDEX IF NOT EXISTS submissions_status_date ON submissions(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at);
      CREATE INDEX IF NOT EXISTS audit_logs_date ON audit_logs(created_at DESC);
    `)
  }

  private seed() {
    const count = Number(this.db.prepare('SELECT COUNT(*) AS count FROM works').get()?.count || 0)
    const now = new Date().toISOString()
    if (count === 0) {
      const workStatement = this.db.prepare(`
      INSERT INTO works (id,type,title,author,summary,body,disciplines_json,tags_json,basis,note,references_text,episode,spoiler,ai_usage,rights,source_author,source_url,status,published_at,sample,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `)
      for (const work of initialWorks) this.insertWork(workStatement, work, now)
      const issueStatement = this.db.prepare(`
        INSERT INTO issues (id,slug,number,title,description,editorial,cover,work_ids_json,status,published_at,sample,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `)
      for (const issue of initialIssues) issueStatement.run(issue.id, issue.slug, issue.number, issue.title, issue.description, issue.editorial, issue.cover, json(issue.workIds), issue.status, issue.publishedAt, issue.sample ? 1 : 0, now, now)
    }
    const submissionCount = Number(this.db.prepare('SELECT COUNT(*) AS count FROM submissions').get()?.count || 0)
    if (submissionCount === 0) {
      const submissionStatement = this.db.prepare(`
      INSERT INTO submissions (id,request_key,type,title,author,email,summary,body,disciplines_json,tags_json,basis,note,references_text,episode,spoiler,ai_usage,ai_detail,rights,source_author,source_url,authorization,consent,nonfiction,status,review_note,published_at,sample,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `)
      for (const submission of initialSubmissions) {
        submissionStatement.run(submission.id, `seed-${submission.id}`, submission.type, submission.title, submission.author, submission.email, submission.summary, submission.body, json(submission.disciplines), json(submission.tags), submission.basis, submission.note, submission.references, submission.episode, submission.spoiler ? 1 : 0, submission.aiUsage, submission.aiDetail, submission.rights, submission.sourceAuthor, submission.sourceUrl, submission.authorization, 1, 1, submission.status, submission.reviewNote || '', submission.publishedAt, submission.sample ? 1 : 0, now, now)
      }
    }
  }

  private insertWork(statement: ReturnType<DatabaseSync['prepare']>, work: Work, now: string) {
    statement.run(work.id, work.type, work.title, work.author, work.summary, work.body, json(work.disciplines), json(work.tags), work.basis, work.note, work.references, work.episode, work.spoiler ? 1 : 0, work.aiUsage, work.rights, work.sourceAuthor, work.sourceUrl, work.status, work.publishedAt, work.sample ? 1 : 0, now, now)
  }

  private mapWork(row: Row): WorkRecord {
    return {
      id: stringValue(row.id), type: row.type as Work['type'], title: stringValue(row.title), author: stringValue(row.author),
      summary: stringValue(row.summary), body: stringValue(row.body), disciplines: parseJson(row.disciplines_json, [] as string[]),
      tags: parseJson(row.tags_json, [] as string[]), basis: stringValue(row.basis), note: stringValue(row.note),
      references: stringValue(row.references_text), episode: stringValue(row.episode), spoiler: boolValue(row.spoiler),
      aiUsage: row.ai_usage as Work['aiUsage'], rights: row.rights as Work['rights'], sourceAuthor: stringValue(row.source_author),
      sourceUrl: stringValue(row.source_url), status: row.status as Work['status'], publishedAt: stringValue(row.published_at),
      sample: boolValue(row.sample), createdAt: stringValue(row.created_at), updatedAt: stringValue(row.updated_at),
    }
  }

  private mapSubmission(row: Row): SubmissionRecord {
    return {
      ...this.mapWork(row), email: stringValue(row.email), authorization: stringValue(row.authorization),
      aiDetail: stringValue(row.ai_detail), reviewNote: stringValue(row.review_note) || undefined,
      requestKey: stringValue(row.request_key), createdAt: stringValue(row.created_at), updatedAt: stringValue(row.updated_at),
    }
  }

  private mapComment(row: Row): CommentRecord {
    return { id: stringValue(row.id), workId: stringValue(row.work_id), nickname: stringValue(row.nickname), body: stringValue(row.body), status: row.status as Comment['status'], requestKey: stringValue(row.request_key), createdAt: stringValue(row.created_at), updatedAt: stringValue(row.updated_at) }
  }

  private mapIssue(row: Row): IssueRecord {
    return { id: stringValue(row.id), slug: stringValue(row.slug), number: stringValue(row.number), title: stringValue(row.title), description: stringValue(row.description), editorial: stringValue(row.editorial), cover: stringValue(row.cover), workIds: parseJson(row.work_ids_json, [] as string[]), status: row.status as Issue['status'], publishedAt: stringValue(row.published_at), sample: boolValue(row.sample), createdAt: stringValue(row.created_at), updatedAt: stringValue(row.updated_at) }
  }

  listWorks(publicOnly = true) {
    const rows = this.db.prepare(`SELECT * FROM works ${publicOnly ? "WHERE status = 'published'" : ''} ORDER BY published_at DESC, id ASC`).all() as Row[]
    return rows.map(row => this.mapWork(row))
  }

  getWork(id: string, publicOnly = true) {
    const row = this.db.prepare(`SELECT * FROM works WHERE id = ? ${publicOnly ? "AND status = 'published'" : ''}`).get(id) as Row | undefined
    return row ? this.mapWork(row) : undefined
  }

  insertSubmission(submission: Submission, requestKey: string, now: string) {
    const statement = this.db.prepare(`
      INSERT INTO submissions (id,request_key,type,title,author,email,summary,body,disciplines_json,tags_json,basis,note,references_text,episode,spoiler,ai_usage,ai_detail,rights,source_author,source_url,authorization,consent,nonfiction,status,review_note,published_at,sample,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `)
    statement.run(submission.id, requestKey, submission.type, submission.title, submission.author, submission.email, submission.summary, submission.body, json(submission.disciplines), json(submission.tags), submission.basis, submission.note, submission.references, submission.episode, submission.spoiler ? 1 : 0, submission.aiUsage, submission.aiDetail, submission.rights, submission.sourceAuthor, submission.sourceUrl, submission.authorization, 1, submission.type === 'analysis' ? 1 : 1, submission.status, '', '', submission.sample ? 1 : 0, now, now)
    return this.getSubmission(submission.id)!
  }

  getSubmission(id: string) {
    const row = this.db.prepare('SELECT * FROM submissions WHERE id = ?').get(id) as Row | undefined
    return row ? this.mapSubmission(row) : undefined
  }

  findSubmissionByRequestKey(requestKey: string) {
    const row = this.db.prepare('SELECT * FROM submissions WHERE request_key = ?').get(requestKey) as Row | undefined
    return row ? this.mapSubmission(row) : undefined
  }

  createAdminSession(tokenHash: string, expiresAt: number, createdAt: string) {
    this.db.prepare('INSERT OR REPLACE INTO admin_sessions (token_hash, expires_at, created_at) VALUES (?, ?, ?)').run(tokenHash, expiresAt, createdAt)
  }

  getAdminSession(tokenHash: string) {
    const row = this.db.prepare('SELECT token_hash, expires_at, created_at FROM admin_sessions WHERE token_hash = ?').get(tokenHash) as Row | undefined
    if (!row) return undefined
    return { tokenHash: stringValue(row.token_hash), expiresAt: Number(row.expires_at), createdAt: stringValue(row.created_at) }
  }

  deleteAdminSession(tokenHash: string) {
    this.db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash)
  }

  deleteExpiredAdminSessions(now: number) {
    this.db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(now)
  }

  recordAuditLog(actor: string, action: string, targetType: string, targetId: string, details: Record<string, unknown>, createdAt: string) {
    this.db.prepare('INSERT INTO audit_logs (actor, action, target_type, target_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(actor, action, targetType, targetId, json(details), createdAt)
  }

  listAuditLogs(limit = 100): AuditLogRecord[] {
    const safeLimit = Math.min(500, Math.max(1, Math.floor(limit)))
    const rows = this.db.prepare('SELECT id, actor, action, target_type, target_id, details_json, created_at FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT ?').all(safeLimit) as Row[]
    return rows.map(row => ({
      id: Number(row.id),
      actor: stringValue(row.actor),
      action: stringValue(row.action),
      targetType: stringValue(row.target_type),
      targetId: stringValue(row.target_id),
      details: parseJson(row.details_json, {} as Record<string, unknown>),
      createdAt: stringValue(row.created_at),
    }))
  }

  listSubmissions(status?: string) {
    const rows = this.db.prepare(`SELECT * FROM submissions ${status ? 'WHERE status = ?' : ''} ORDER BY created_at DESC`).all(...(status ? [status] : [])) as Row[]
    return rows.map(row => this.mapSubmission(row))
  }

  reviewSubmission(id: string, approve: boolean, reviewNote: string, now: string) {
    const submission = this.getSubmission(id)
    if (!submission || submission.status !== 'pending') return undefined
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const status = approve ? 'published' : 'rejected'
      this.db.prepare('UPDATE submissions SET status = ?, review_note = ?, published_at = ?, updated_at = ? WHERE id = ?').run(status, reviewNote, approve ? now : '', now, id)
      if (approve) {
        const work: Work = { ...submission, status: 'published', publishedAt: now, sample: false }
        const statement = this.db.prepare(`
          INSERT INTO works (id,type,title,author,summary,body,disciplines_json,tags_json,basis,note,references_text,episode,spoiler,ai_usage,rights,source_author,source_url,status,published_at,sample,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `)
        this.insertWork(statement, work, now)
      }
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
    return this.getSubmission(id)
  }

  withdrawWork(id: string, now: string) {
    const work = this.getWork(id, false)
    if (!work || work.status !== 'published') return undefined
    this.db.prepare("UPDATE works SET status = 'withdrawn', updated_at = ? WHERE id = ?").run(now, id)
    return this.getWork(id, false)
  }

  listComments(workId?: string, publicOnly = false) {
    const clauses = [workId ? 'work_id = ?' : '', publicOnly ? "status = 'approved'" : ''].filter(Boolean)
    const rows = this.db.prepare(`SELECT * FROM comments ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY created_at ASC`).all(...(workId ? [workId] : [])) as Row[]
    return rows.map(row => this.mapComment(row))
  }

  insertComment(comment: Comment, requestKey: string, now: string) {
    this.db.prepare('INSERT INTO comments (id,request_key,work_id,nickname,body,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(comment.id, requestKey, comment.workId, comment.nickname, comment.body, 'pending', now, now)
    return this.getComment(comment.id)!
  }

  getComment(id: string) {
    const row = this.db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as Row | undefined
    return row ? this.mapComment(row) : undefined
  }

  findCommentByRequestKey(requestKey: string) {
    const row = this.db.prepare('SELECT * FROM comments WHERE request_key = ?').get(requestKey) as Row | undefined
    return row ? this.mapComment(row) : undefined
  }

  reviewComment(id: string, status: Comment['status'], now: string) {
    this.db.prepare('UPDATE comments SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id)
    return this.getComment(id)
  }

  listIssues(publicOnly = true) {
    const rows = this.db.prepare(`SELECT * FROM issues ${publicOnly ? "WHERE status = 'published'" : ''} ORDER BY published_at DESC, number DESC`).all() as Row[]
    return rows.map(row => this.mapIssue(row))
  }

  getIssue(slug: string, publicOnly = true) {
    const row = this.db.prepare(`SELECT * FROM issues WHERE slug = ? ${publicOnly ? "AND status = 'published'" : ''}`).get(slug) as Row | undefined
    return row ? this.mapIssue(row) : undefined
  }

  saveIssue(issue: Issue, now: string) {
    this.db.prepare(`
      INSERT INTO issues (id,slug,number,title,description,editorial,cover,work_ids_json,status,published_at,sample,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,number=excluded.number,title=excluded.title,description=excluded.description,editorial=excluded.editorial,cover=excluded.cover,work_ids_json=excluded.work_ids_json,status=excluded.status,published_at=excluded.published_at,sample=excluded.sample,updated_at=excluded.updated_at
    `).run(issue.id, issue.slug, issue.number, issue.title, issue.description, issue.editorial, issue.cover, json(issue.workIds), issue.status, issue.publishedAt, issue.sample ? 1 : 0, now, now)
    return this.getIssue(issue.slug, false)!
  }

  close() { this.db.close() }
}
