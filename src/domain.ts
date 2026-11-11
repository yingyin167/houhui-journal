import { z } from 'zod'

export const typeNames = { analysis: '观察与研究', poetry: '诗歌', prose: '散文' } as const
export type WorkType = keyof typeof typeNames
export const aiNames = { none: '未使用 AI', assisted: 'AI 辅助', generated: 'AI 生成主体' } as const
export type AiUsage = keyof typeof aiNames
export const disciplines = ['心理学', '教育学', '社会学', '文学与语言', '自然科学', '数学与计算', '其他 / 跨学科']
export type WorkStatus = 'pending' | 'published' | 'rejected' | 'withdrawn'

export interface Work {
  id: string
  type: WorkType
  title: string
  author: string
  summary: string
  body: string
  disciplines: string[]
  tags: string[]
  basis: string
  note: string
  references: string
  episode: string
  spoiler: boolean
  aiUsage: AiUsage
  rights: 'original' | 'authorized_reprint'
  sourceAuthor: string
  sourceUrl: string
  status: WorkStatus
  publishedAt: string
  sample: boolean
}

export interface Submission extends Work {
  email: string
  authorization: string
  aiDetail: string
  consent?: boolean
  nonfiction?: boolean
  reviewNote?: string
}

export interface Comment {
  id: string
  workId: string
  nickname: string
  body: string
  status: 'pending' | 'approved' | 'rejected'
}

export interface Issue {
  id: string
  slug: string
  number: string
  title: string
  description: string
  editorial: string
  cover: string
  workIds: string[]
  status: 'draft' | 'published'
  publishedAt: string
  sample: boolean
}

export interface AuditLog {
  id: number
  actor: string
  action: string
  targetType: string
  targetId: string
  details: Record<string, unknown>
  createdAt: string
}

export interface SubmissionInput {
  type: WorkType
  title: string
  author: string
  email: string
  summary: string
  body: string
  disciplines: string[]
  tags: string
  basis: string
  note: string
  references: string
  episode: string
  spoiler: boolean
  rights: Work['rights']
  sourceAuthor: string
  sourceUrl: string
  authorization: string
  aiUsage: AiUsage
  aiDetail: string
  consent: boolean
  nonfiction: boolean
}

export const blankSubmission: SubmissionInput = {
  type: 'analysis', title: '', author: '', email: '', summary: '', body: '', disciplines: [],
  tags: '', basis: '', note: '', references: '', episode: '', spoiler: false,
  rights: 'original', sourceAuthor: '', sourceUrl: '', authorization: '',
  aiUsage: 'none', aiDetail: '', consent: false, nonfiction: false,
}

const shortText = (label: string, max: number) => z.string().trim()
  .min(1, `请填写${label}`)
  .refine(value => Array.from(value).length <= max, `${label}不能超过 ${max} 字`)

const submissionSchema = z.object({
  type: z.enum(['analysis', 'poetry', 'prose']),
  title: shortText('标题', 120),
  author: shortText('署名', 40),
  email: z.email('请填写有效的联系邮箱'),
  body: shortText('正文', 50000),
  summary: z.string(),
  disciplines: z.array(z.string()),
  tags: z.string(),
  basis: z.string(),
  rights: z.enum(['original', 'authorized_reprint']),
  sourceAuthor: z.string(),
  sourceUrl: z.string(),
  authorization: z.string(),
  aiUsage: z.enum(['none', 'assisted', 'generated']),
  aiDetail: z.string(),
  consent: z.boolean(),
  nonfiction: z.boolean(),
}).superRefine((data, context) => {
  const error = (path: string, message: string) =>
    context.addIssue({ code: 'custom', path: [path], message })
  if (!data.consent) error('consent', '请阅读并确认投稿规则')
  if (data.type === 'analysis') {
    if (!data.summary.trim()) error('summary', '请填写文章摘要')
    if (Array.from(data.summary).length > 600) error('summary', '摘要不能超过 600 字')
    if (data.disciplines.length < 1 || data.disciplines.length > 3 ||
      data.disciplines.some(discipline => !disciplines.includes(discipline))) {
      error('disciplines', '请选择 1-3 个学科')
    }
  } else {
    if (!data.basis.trim()) error('basis', '请简述真实材料或经历的依据')
    if (Array.from(data.basis).length > 1000) error('basis', '写作依据不能超过 1,000 字')
    if (!data.nonfiction) error('nonfiction', '请确认作品符合非虚构收稿边界')
  }
  const tags = parseTags(data.tags)
  if (tags.length > 5 || tags.some(tag => Array.from(tag).length > 20)) {
    error('tags', '最多填写 5 个关键词，每个不超过 20 字')
  }
  if (data.rights === 'authorized_reprint') {
    if (!data.sourceAuthor.trim()) error('sourceAuthor', '请填写原作者署名')
    if (!isSafeUrl(data.sourceUrl)) error('sourceUrl', '请填写有效的 HTTP 或 HTTPS 原文地址')
    if (!data.authorization.trim()) error('authorization', '请说明已获得的转载与收录授权')
  }
  if (data.aiUsage !== 'none' && !data.aiDetail.trim()) error('aiDetail', '请说明 AI 工具与使用环节')
})

export function validateSubmission(data: SubmissionInput): Record<string, string> {
  const result = submissionSchema.safeParse(data)
  if (result.success) return {}
  return Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message]))
}

export function parseTags(value: string) {
  return [...new Set(value.split(/[,，、]/).map(tag => tag.trim()).filter(Boolean))]
}

export function isSafeUrl(value: string) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}

export function publicWorks(works: Work[]) {
  return works.filter(work => work.status === 'published')
}

export function filterWorks(works: Work[], params: URLSearchParams) {
  const query = params.get('q')?.trim().toLocaleLowerCase() ?? ''
  const type = params.get('type') ?? ''
  const discipline = type && type !== 'analysis' ? '' : params.get('discipline') ?? ''
  const tag = params.get('tag') ?? ''
  return publicWorks(works).filter(work => {
    const text = [work.title, work.author, work.summary, work.body, ...work.tags].join(' ').toLocaleLowerCase()
    return (!query || text.includes(query)) && (!type || work.type === type) &&
      (!discipline || work.disciplines.includes(discipline)) && (!tag || work.tags.includes(tag))
  }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id))
}

export function issueWorks(issue: Issue, works: Work[]) {
  return issue.workIds.map(id => works.find(work => work.id === id && work.status === 'published'))
    .filter((work): work is Work => Boolean(work))
}

export function excerpt(work: Work) {
  if (work.spoiler) return '本文涉及节目内容，进入正文后查看。'
  return work.type === 'analysis' ? work.summary : work.body.split('\n').filter(Boolean).slice(0, 3).join(' / ')
}

export function toPublicWork(submission: Submission): Work {
  const { email: _email, authorization: _authorization, aiDetail: _aiDetail, reviewNote: _reviewNote, ...work } = submission
  return work
}
