import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { disciplines, isSafeUrl, parseTags, typeNames } from '../src/domain'
import type { Comment, Issue, Submission, SubmissionInput, Work } from '../src/domain'
import type { CommentRecord, IssueRecord, SubmissionRecord, WorkRecord } from './types'

const text = (label: string, max: number) => z.string().trim().min(1, `请填写${label}`).refine(value => Array.from(value).length <= max, `${label}不能超过 ${max} 字`)

const submissionSchema = z.object({
  type: z.enum(['analysis', 'poetry', 'prose']), title: text('标题', 120), author: text('署名', 40),
  email: z.email('请填写有效的联系邮箱'), summary: z.string(), body: text('正文', 50000),
  disciplines: z.array(z.string()), tags: z.string(), basis: z.string(), note: z.string(),
  references: z.string(), episode: z.string(), spoiler: z.boolean(), rights: z.enum(['original', 'authorized_reprint']),
  sourceAuthor: z.string(), sourceUrl: z.string(), authorization: z.string(), aiUsage: z.enum(['none', 'assisted', 'generated']),
  aiDetail: z.string(), consent: z.literal(true, { error: '请阅读并确认投稿规则' }), nonfiction: z.boolean(),
}).superRefine((data, context) => {
  const error = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message })
  if (data.type === 'analysis') {
    if (!data.summary.trim()) error('summary', '请填写文章摘要')
    if (Array.from(data.summary).length > 600) error('summary', '摘要不能超过 600 字')
    if (data.disciplines.length < 1 || data.disciplines.length > 3 || data.disciplines.some(item => !disciplines.includes(item))) error('disciplines', '请选择 1-3 个学科')
  } else {
    if (!data.basis.trim()) error('basis', '请简述真实材料或经历的依据')
    if (Array.from(data.basis).length > 1000) error('basis', '写作依据不能超过 1,000 字')
    if (!data.nonfiction) error('nonfiction', '请确认作品符合非虚构收稿边界')
  }
  const tags = parseTags(data.tags)
  if (tags.length > 5 || tags.some(tag => Array.from(tag).length > 20)) error('tags', '最多填写 5 个关键词，每个不超过 20 字')
  if (data.rights === 'authorized_reprint') {
    if (!data.sourceAuthor.trim()) error('sourceAuthor', '请填写原作者署名')
    if (!isSafeUrl(data.sourceUrl)) error('sourceUrl', '请填写有效的 HTTP 或 HTTPS 原文地址')
    if (!data.authorization.trim()) error('authorization', '请说明已获得的转载与收录授权')
  }
  if (data.aiUsage !== 'none' && !data.aiDetail.trim()) error('aiDetail', '请说明 AI 工具与使用环节')
})

export function parseSubmission(input: unknown) {
  const result = submissionSchema.safeParse(input)
  if (!result.success) {
    const fields = Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message]))
    return { success: false as const, fields }
  }
  return { success: true as const, data: result.data }
}

const commentSchema = z.object({
  nickname: text('笔名', 40),
  body: text('评论内容', 2000),
})

export function parseComment(input: unknown) {
  const result = commentSchema.safeParse(input)
  if (!result.success) return { success: false as const, fields: Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message])) }
  return { success: true as const, data: result.data }
}

const issueSchema = z.object({
  id: z.string().optional(), slug: z.string().trim().regex(/^[a-z0-9-]{3,80}$/, 'slug 格式不正确'),
  number: z.string().trim().regex(/^\d{1,4}$/, '期号必须是 1-4 位数字'), title: text('标题', 80),
  description: text('本期导语', 300), editorial: text('卷首语', 5000), cover: z.string().trim().min(1),
  workIds: z.array(z.string()).min(1, '至少收录一篇公开作品'), status: z.enum(['draft', 'published']),
  publishedAt: z.string().optional(), sample: z.boolean().default(false),
})

export function parseIssue(input: unknown) {
  const result = issueSchema.safeParse(input)
  if (!result.success) return { success: false as const, fields: Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message])) }
  return { success: true as const, data: result.data }
}

export function toSubmission(data: SubmissionInput): Submission {
  return {
    id: randomUUID(), type: data.type, title: data.title.trim(),
    author: data.rights === 'authorized_reprint' ? data.sourceAuthor.trim() : data.author.trim(),
    summary: data.type === 'analysis' ? data.summary.trim() : '', body: data.body,
    disciplines: data.type === 'analysis' ? data.disciplines : [], tags: parseTags(data.tags),
    basis: data.basis.trim(), note: data.note.trim(), references: data.references.trim(),
    episode: data.episode.trim(), spoiler: data.spoiler, aiUsage: data.aiUsage, rights: data.rights,
    sourceAuthor: data.sourceAuthor.trim(), sourceUrl: data.sourceUrl.trim(), authorization: data.authorization.trim(),
    aiDetail: data.aiDetail.trim(), consent: data.consent, nonfiction: data.nonfiction,
    status: 'pending', publishedAt: '', sample: false,
    email: data.email.trim(),
  }
}

export function publicWork(work: WorkRecord | Work): Work {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...safe } = work as WorkRecord
  return safe
}

export function publicComment(comment: CommentRecord): Comment {
  return { id: comment.id, workId: comment.workId, nickname: comment.nickname, body: comment.body, status: 'approved' }
}

export function publicIssue(issue: IssueRecord, works: WorkRecord[]): Issue {
  return { id: issue.id, slug: issue.slug, number: issue.number, title: issue.title, description: issue.description, editorial: issue.editorial, cover: issue.cover, workIds: issue.workIds.filter(id => works.some(work => work.id === id && work.status === 'published')), status: 'published', publishedAt: issue.publishedAt, sample: issue.sample }
}

export { typeNames }
