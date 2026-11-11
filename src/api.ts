import type { AuditLog, Comment, Issue, Submission, SubmissionInput, Work } from './domain'

type ApiErrorPayload = { error?: { code?: string; message?: string; fields?: Record<string, string> } }

export class ApiError extends Error {
  code: string
  fields?: Record<string, string>
  status: number
  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.error?.message || '请求失败')
    this.name = 'ApiError'
    this.status = status
    this.code = payload.error?.code || 'REQUEST_FAILED'
    this.fields = payload.error?.fields
  }
}

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(path, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } })
  const payload = await response.json().catch(() => ({})) as T & ApiErrorPayload
  if (!response.ok) throw new ApiError(response.status, payload)
  return payload as T
}

const key = () => crypto.randomUUID()

export async function getWorks(params = '') {
  return request<{ data: Work[]; meta: { total: number; pageCount: number } }>(`/api/works${params}`)
}
export async function getIssues() { return request<{ data: Issue[] }>('/api/issues') }
export async function getComments(workId: string) { return request<{ data: Comment[] }>(`/api/works/${encodeURIComponent(workId)}/comments`) }
export async function submitWork(input: SubmissionInput) {
  return request<{ data: { id: string; status: string } }>('/api/submissions', { method: 'POST', headers: { 'Idempotency-Key': key() }, body: JSON.stringify(input) })
}
export async function submitComment(workId: string, nickname: string, body: string) {
  return request<{ data: { id: string; status: string } }>(`/api/works/${encodeURIComponent(workId)}/comments`, { method: 'POST', headers: { 'Idempotency-Key': key() }, body: JSON.stringify({ nickname, body }) })
}
export async function adminSession() { return request<{ data: { authenticated: boolean } }>('/api/admin/session') }
export async function adminLogin(password: string) { return request<{ data: { authenticated: boolean } }>('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) }) }
export async function adminLogout() { await request('/api/admin/logout', { method: 'POST' }) }
export async function getAdminSubmissions(status?: string) { return request<{ data: Submission[] }>(`/api/admin/submissions${status ? `?status=${encodeURIComponent(status)}` : ''}`) }
export async function reviewSubmission(id: string, approve: boolean, reviewNote = '') { return request<{ data: { id: string; status: string } }>(`/api/admin/submissions/${encodeURIComponent(id)}/review`, { method: 'POST', body: JSON.stringify({ approve, reviewNote }) }) }
export async function getAdminComments() { return request<{ data: Comment[] }>('/api/admin/comments') }
export async function reviewComment(id: string, status: 'approved' | 'rejected' | 'hidden') { return request<{ data: { id: string; status: string } }>(`/api/admin/comments/${encodeURIComponent(id)}/review`, { method: 'POST', body: JSON.stringify({ status }) }) }
export async function getAdminIssues() { return request<{ data: Issue[] }>('/api/admin/issues') }
export async function getAdminAuditLogs() { return request<{ data: AuditLog[] }>('/api/admin/audit-logs?limit=100') }
export async function saveAdminIssue(issue: Issue) { return request<{ data: Issue }>('/api/admin/issues', { method: 'POST', body: JSON.stringify(issue) }) }
export async function withdrawWork(id: string) { return request<{ data: { id: string; status: string } }>(`/api/admin/works/${encodeURIComponent(id)}/withdraw`, { method: 'POST' }) }
