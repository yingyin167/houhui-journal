import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { serverConfig } from './config'
import { JournalDatabase } from './database'

const hash = (value: string) => createHash('sha256').update(value).digest()
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function verifyPassword(candidate: string) {
  if (!serverConfig.adminPassword) return false
  const a = hash(candidate)
  const b = hash(serverConfig.adminPassword)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function createAdminAuth(database: JournalDatabase) {
  function createSession() {
    const token = randomBytes(32).toString('hex')
    const expiresAt = Date.now() + serverConfig.sessionHours * 60 * 60 * 1000
    database.deleteExpiredAdminSessions(Date.now())
    database.createAdminSession(hashToken(token), expiresAt, new Date().toISOString())
    return token
  }

  function getSession(req: Request) {
    const token = req.signedCookies?.houhui_admin as string | undefined
    if (!token) return undefined
    const tokenHash = hashToken(token)
    const session = database.getAdminSession(tokenHash)
    if (!session || session.expiresAt <= Date.now()) {
      database.deleteAdminSession(tokenHash)
      return undefined
    }
    return session
  }

  function adminRequired(req: Request, res: Response, next: NextFunction) {
    if (!getSession(req)) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '需要管理员登录' } })
      return
    }
    next()
  }

  function destroySession(req: Request) {
    const token = req.signedCookies?.houhui_admin as string | undefined
    if (token) database.deleteAdminSession(hashToken(token))
  }

  return { createSession, adminRequired, destroySession }
}

export function sessionCookieOptions() {
  return { httpOnly: true, signed: true, sameSite: 'lax' as const, secure: serverConfig.isProduction, maxAge: serverConfig.sessionHours * 60 * 60 * 1000, path: '/' }
}
