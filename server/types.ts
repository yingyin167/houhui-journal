import type { Comment, Issue, Submission, SubmissionInput, Work, WorkStatus } from '../src/domain'

export interface SubmissionRecord extends Submission {
  requestKey: string
  createdAt: string
  updatedAt: string
}

export interface WorkRecord extends Work {
  createdAt: string
  updatedAt: string
}

export interface CommentRecord extends Comment {
  requestKey: string
  createdAt: string
  updatedAt: string
}

export interface IssueRecord extends Issue {
  createdAt: string
  updatedAt: string
}

export interface AdminSession {
  token: string
  expiresAt: number
}

export interface StoredAdminSession {
  tokenHash: string
  expiresAt: number
  createdAt: string
}

export interface AuditLogRecord {
  id: number
  actor: string
  action: string
  targetType: string
  targetId: string
  details: Record<string, unknown>
  createdAt: string
}

export interface PublicWorkQuery {
  q?: string
  type?: string
  discipline?: string
  tag?: string
  page?: number
  pageSize?: number
}

export type ReviewStatus = Extract<WorkStatus, 'pending' | 'published' | 'rejected'>
export type { Comment, Issue, Submission, SubmissionInput, Work }
