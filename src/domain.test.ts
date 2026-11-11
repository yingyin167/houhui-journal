import { describe, expect, it } from 'vitest'
import { initialIssues, initialSubmissions, initialWorks } from './data'
import { blankSubmission, filterWorks, isSafeUrl, issueWorks, parseTags, publicWorks, toPublicWork, validateSubmission } from './domain'
import type { SubmissionInput } from './domain'

const validAnalysis: SubmissionInput = {
  ...blankSubmission, title: '观察标题', author: '测试作者', email: 'writer@example.com',
  summary: '一份摘要', body: '正文材料', disciplines: ['心理学'], consent: true,
}
const validPoem: SubmissionInput = {
  ...validAnalysis, type: 'poetry', summary: '', disciplines: [], body: '第一行\n第二行\n\n第三行',
  basis: '来自本人的真实观看与感受，并说明节目关联。', nonfiction: true,
}

describe('submission rules', () => {
  it('accepts an analysis and a poem without forcing an abstract on literature', () => {
    expect(validateSubmission(validAnalysis)).toEqual({})
    expect(validateSubmission(validPoem)).toEqual({})
  })
  it('requires private email, facts and nonfiction confirmation', () => {
    expect(validateSubmission({ ...validPoem, email: '', basis: '', nonfiction: false }))
      .toMatchObject({ email: expect.any(String), basis: expect.any(String), nonfiction: expect.any(String) })
  })
  it('requires analysis abstract and 1-3 known disciplines', () => {
    expect(validateSubmission({ ...validAnalysis, summary: '', disciplines: [] })).toMatchObject({ summary: expect.any(String), disciplines: expect.any(String) })
    expect(validateSubmission({ ...validAnalysis, disciplines: ['未知'] })).toHaveProperty('disciplines')
  })
  it('accepts substantial AI generation with disclosure, not without it', () => {
    expect(validateSubmission({ ...validPoem, aiUsage: 'generated', aiDetail: 'AI 生成主体，作者核实材料。' })).toEqual({})
    expect(validateSubmission({ ...validPoem, aiUsage: 'generated' })).toHaveProperty('aiDetail')
  })
  it('requires republication attribution, safe source and permission', () => {
    expect(validateSubmission({ ...validPoem, rights: 'authorized_reprint' })).toMatchObject({
      sourceAuthor: expect.any(String), sourceUrl: expect.any(String), authorization: expect.any(String),
    })
    expect(validateSubmission({ ...validPoem, rights: 'authorized_reprint', sourceAuthor: '原作者',
      sourceUrl: 'https://example.com/original', authorization: '获得网站展示及期刊收录授权' })).toEqual({})
  })
  it('rejects unsafe links and deduplicates keywords', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('https://user:password@example.com')).toBe(false)
    expect(isSafeUrl('https://example.com/article')).toBe(true)
    expect(parseTags('关系，倾听,关系、表达')).toEqual(['关系', '倾听', '表达'])
    expect(validateSubmission({ ...validAnalysis, tags: '一,二,三,四,五,六' })).toHaveProperty('tags')
  })
})

describe('publication boundary', () => {
  it('only exposes published works', () => {
    expect(publicWorks([...initialWorks, ...initialSubmissions])).toHaveLength(8)
    expect(filterWorks([...initialWorks, ...initialSubmissions], new URLSearchParams('q=待审流程'))).toHaveLength(0)
  })
  it('searches body and intersects type, discipline and keywords', () => {
    expect(filterWorks(initialWorks, new URLSearchParams('q=无从得知'))[0].id).toBe('sample-05')
    expect(filterWorks(initialWorks, new URLSearchParams({ type: 'analysis', discipline: '心理学', tag: '表达' })).map(work => work.id)).toEqual(['sample-01'])
  })
  it('does not apply research discipline to poetry filtering', () => {
    expect(filterWorks(initialWorks, new URLSearchParams({ type: 'poetry', discipline: '心理学' }))).toHaveLength(2)
  })
  it('preserves issue order and removes withdrawn works from contents', () => {
    expect(issueWorks(initialIssues[0], initialWorks).map(work => work.id)).toEqual(initialIssues[0].workIds)
    expect(issueWorks(initialIssues[0], initialWorks.map(work => work.id === 'sample-04' ? { ...work, status: 'withdrawn' } : work)).map(work => work.id)).not.toContain('sample-04')
  })
  it('keeps private fields out of a public work', () => {
    const work = toPublicWork({ ...initialSubmissions[0], reviewNote: '私密备注' })
    expect(work).not.toHaveProperty('email')
    expect(work).not.toHaveProperty('authorization')
    expect(work).not.toHaveProperty('aiDetail')
    expect(work).not.toHaveProperty('reviewNote')
  })
})
