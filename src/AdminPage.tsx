import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpRight, Check, Eye, FilePlus2, History, MessageSquare, ShieldCheck, X } from 'lucide-react'
import { AiLabel, BodyRenderer, Breadcrumb, EmptyState, Field, Modal, formatDate } from './components'
import { publicWorks, typeNames } from './domain'
import type { Issue, Submission } from './domain'
import { useJournal } from './store'

function IssueEditor({ issue, onClose }: { issue?: Issue; onClose: () => void }) {
  const { works, adminIssues: issues, saveIssue } = useJournal()
  const [draft, setDraft] = useState<Issue>(issue ? { ...issue, workIds: [...issue.workIds] } : {
    id: crypto.randomUUID(), slug: '', number: '', title: '', description: '', editorial: '',
    cover: '/assets/issue-001.png', workIds: [], status: 'draft', publishedAt: '', sample: true,
  })
  const [error, setError] = useState('')
  const available = publicWorks(works)
  function update<K extends keyof Issue>(key: K, value: Issue[K]) { setDraft(previous => ({ ...previous, [key]: value })); setError('') }
  async function save(status: Issue['status']) {
    if (!draft.title.trim() || !/^\d{1,4}$/.test(draft.number)) { setError('请填写期刊标题和 1–4 位数字期号。'); return }
    if (issues.some(item => item.id !== draft.id && Number(item.number) === Number(draft.number))) { setError('期号已存在。'); return }
    const workIds = draft.workIds.filter(id => available.some(work => work.id === id))
    if (status === 'published' && (!workIds.length || !draft.description.trim() || !draft.editorial.trim())) { setError('发布需要导语、卷首语及至少一篇已公开作品。'); return }
    try {
      await saveIssue({ ...draft, title: draft.title.trim(), slug: draft.slug || `vol-${draft.number}`, workIds, status, publishedAt: status === 'published' ? draft.publishedAt || new Date().toISOString() : draft.publishedAt })
      onClose()
    } catch (error) { setError(error instanceof Error ? error.message : '期刊保存失败，请稍后重试。') }
  }
  function move(index: number, direction: number) {
    const list = [...draft.workIds]
    const to = index + direction
    if (to < 0 || to >= list.length) return
    ;[list[index], list[to]] = [list[to], list[index]]
    update('workIds', list)
  }
  return <Modal title={issue ? '编辑期刊 · 本地演示' : '新建期刊 · 本地演示'} onClose={onClose} wide>
    <div className="field-grid"><Field name="issue-number" label="期号" required><input aria-label="期号" id="issue-number" inputMode="numeric" maxLength={4} value={draft.number} onChange={event => update('number', event.target.value)} /></Field><Field name="issue-title" label="标题" required><input aria-label="标题" id="issue-title" maxLength={80} value={draft.title} onChange={event => update('title', event.target.value)} /></Field></div>
    <Field name="issue-description" label="本期导语"><textarea aria-label="本期导语" id="issue-description" rows={2} maxLength={300} value={draft.description} onChange={event => update('description', event.target.value)} /></Field>
    <Field name="issue-editorial" label="卷首语"><textarea aria-label="卷首语" id="issue-editorial" rows={4} maxLength={5000} value={draft.editorial} onChange={event => update('editorial', event.target.value)} /></Field>
    <Field name="issue-cover" label="封面"><select id="issue-cover" value={draft.cover} onChange={event => update('cover', event.target.value)}><option value="/assets/issue-001.png">绿底 · 创刊样刊</option><option value="/assets/issue-002.png">白底 · 样刊模板</option></select></Field>
    <div className="issue-picker"><h3>收录作品 <span className="muted">{draft.workIds.length} 篇</span></h3>{available.map(work => <label key={work.id}><input type="checkbox" checked={draft.workIds.includes(work.id)} onChange={event => update('workIds', event.target.checked ? [...draft.workIds, work.id] : draft.workIds.filter(id => id !== work.id))} /><span>{work.title}</span><span className="muted">{typeNames[work.type]}</span></label>)}</div>
    {!!draft.workIds.length && <div className="issue-order"><h3>收录顺序</h3>{draft.workIds.map((id, index) => <div key={id}><span>{index + 1}. {available.find(work => work.id === id)?.title || '已撤下作品（保存后移除）'}</span><button className="icon-button" type="button" title="上移" aria-label={`上移第 ${index + 1} 篇`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></button><button className="icon-button" type="button" title="下移" aria-label={`下移第 ${index + 1} 篇`} disabled={index === draft.workIds.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></button></div>)}</div>}
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="modal-actions"><button className="button" onClick={() => save('draft')}>保存为草稿</button><button className="button primary" onClick={() => save('published')}><Check size={16} />发布演示期刊</button></div>
  </Modal>
}

function ReviewModal({ submission, onClose }: { submission: Submission; onClose: () => void }) {
  const { reviewWork } = useJournal()
  const [confirmed, setConfirmed] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  return <Modal title="稿件审核 · 本地演示" onClose={onClose} wide>
    <span className="type-label">{typeNames[submission.type]}</span><h2 className="preview-title">{submission.title}</h2>
    <div className="review-meta"><span>{submission.author}</span><AiLabel work={submission} /></div>
    <dl className="private-details"><dt>私密联系邮箱</dt><dd>{submission.email}</dd><dt>AI 使用说明</dt><dd>{submission.aiDetail || '未使用 AI'}</dd><dt>来源</dt><dd>{submission.rights === 'original' ? '原创' : `授权转载 / ${submission.sourceAuthor}`}</dd>{submission.sourceUrl && <><dt>原文</dt><dd><a href={submission.sourceUrl} target="_blank" rel="noopener noreferrer">{submission.sourceUrl}<ArrowUpRight size={12} /></a></dd></>}{submission.authorization && <><dt>授权说明</dt><dd>{submission.authorization}</dd></>}</dl>
    {submission.summary && <div className="abstract"><h2>摘要</h2><p>{submission.summary}</p></div>}
    <BodyRenderer body={submission.body} type={submission.type} />
    {submission.basis && <div className="article-appendix"><h3>真实写作依据</h3><p>{submission.basis}</p></div>}
    {submission.episode && <div className="article-appendix"><h3>节目材料</h3><p>{submission.episode}</p></div>}
    {submission.references && <div className="article-appendix"><h3>参考资料</h3><p>{submission.references}</p></div>}
    {submission.note && <div className="article-appendix"><h3>作者说明</h3><p>{submission.note}</p></div>}
    <div className="review-decision"><label className="check-line"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />已核对内容边界、事实材料、隐私及必要转载授权</label><Field label="审核备注" name="review-reason" hint="退回时必填；仅在本次演示中记录。"><textarea id="review-reason" rows={2} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></Field>
      {error && <p role="alert" className="field-error">{error}</p>}<div className="modal-actions"><button className="button danger" disabled={saving} onClick={async () => { if (!reason.trim()) { setError('请填写退回原因。'); return }; setSaving(true); try { await reviewWork(submission.id, false, reason); onClose() } catch (reviewError) { setError(reviewError instanceof Error ? reviewError.message : '审核失败') } finally { setSaving(false) } }}><X size={16} />退回</button><button className="button primary" disabled={!confirmed || saving} onClick={async () => { setSaving(true); try { await reviewWork(submission.id, true, reason); onClose() } catch (reviewError) { setError(reviewError instanceof Error ? reviewError.message : '审核失败') } finally { setSaving(false) } }}><Check size={16} />审核通过并公开</button></div>
    </div>
  </Modal>
}

export function AdminPage() {
  const { works, adminIssues: issues, submissions, comments, auditLogs, reviewComment, withdrawWork, adminAuthenticated, login, logout, refreshAdmin } = useJournal()
  const [tab, setTab] = useState('submissions')
  const [status, setStatus] = useState('pending')
  const [reviewing, setReviewing] = useState<Submission>()
  const [editingIssue, setEditingIssue] = useState<Issue | null | undefined>()
  const [withdrawing, setWithdrawing] = useState<string>()
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const pending = submissions.filter(item => item.status === 'pending')
  const pendingComments = comments.filter(comment => comment.status === 'pending')
  useEffect(() => {
    if (adminAuthenticated) void refreshAdmin()
  }, [adminAuthenticated])
  if (!adminAuthenticated) return <AdminLogin password={password} setPassword={setPassword} error={loginError} loading={loggingIn} onSubmit={async event => {
    event.preventDefault(); setLoggingIn(true); setLoginError('')
    try { await login(password) } catch (error) { setLoginError(error instanceof Error ? error.message : '登录失败') } finally { setLoggingIn(false) }
  }} />
  return <div className="container admin-container"><Breadcrumb items={[{ label: '审核演示' }]} /><div className="page-heading"><div><span className="small-label">EDITORIAL DESK / DEMO</span><h1>编辑台</h1></div><ShieldCheck size={27} strokeWidth={1.4} /></div>
    <div className="local-banner admin-banner"><ShieldCheck size={20} /><div><strong>这是本地开发编辑台，已启用管理员会话。</strong><p>投稿、评论与期刊保存在本地 SQLite；生产部署前仍需配置正式域名、HTTPS、备份和运营邮箱。</p></div></div>
    <div className="admin-tabs" role="group" aria-label="审核分类">{[['submissions', '稿件', pending.length], ['comments', '评论', pendingComments.length], ['issues', '期刊', issues.length], ['audit', '日志', auditLogs.length]].map(([value, label, count]) => <button key={value} className={tab === value ? 'active' : ''} aria-pressed={tab === value} onClick={() => { setTab(String(value)); setMessage('') }}>{label}<span>{count}</span></button>)}<button className="admin-logout" onClick={() => void logout()}>退出</button></div>
    {message && <p className="success-note" role="status"><Check size={16} />{message}</p>}
    {tab === 'submissions' && <><div className="admin-toolbar"><div className="small-tabs">{[['pending', '待审核'], ['published', '已公开'], ['rejected', '已退回']].map(([value, name]) => <button key={value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{name}</button>)}</div><Link className="more-link" to="/submit">新建演示投稿<FilePlus2 size={16} /></Link></div>
      {status === 'published' ? <div className="admin-list">{publicWorks(works).map(work => <article className="admin-row" key={work.id}><span className="type-label">{typeNames[work.type]}</span><div><h3><Link to={`/works/${work.id}`}>{work.title}</Link></h3><p>{work.author} · {formatDate(work.publishedAt)}</p></div><button className="button small danger" onClick={() => setWithdrawing(work.id)}>撤下</button></article>)}</div> :
        <div className="admin-list">{submissions.filter(item => item.status === status).map(item => <article className="admin-row" key={item.id}><span className="type-label">{typeNames[item.type]}</span><div><h3>{item.title}</h3><p>{item.author} · {item.status === 'pending' ? '待审核' : '已退回'}{item.reviewNote && ` · ${item.reviewNote}`}</p></div>{item.status === 'pending' && <button className="button small" onClick={() => setReviewing(item)}><Eye size={15} />审阅</button>}</article>)}{!submissions.some(item => item.status === status) && <EmptyState title={status === 'pending' ? '暂无待审稿件' : '暂无退回稿件'} />}</div>}
    </>}
    {tab === 'comments' && <><div className="admin-toolbar"><h2>待审评论 <span className="muted">{pendingComments.length}</span></h2></div>{pendingComments.length ? <div className="admin-comments">{pendingComments.map(comment => <article key={comment.id}><div className="comment-review-heading"><strong><MessageSquare size={15} />{comment.nickname}</strong><Link to={`/works/${comment.workId}`}>{works.find(work => work.id === comment.workId)?.title || '作品已撤下'}<ArrowUpRight size={13} /></Link></div><p>{comment.body}</p><div className="button-row"><button className="button small danger" onClick={() => { reviewComment(comment.id, false); setMessage('评论已退回，未公开。') }}><X size={15} />退回</button><button className="button small primary" onClick={() => { reviewComment(comment.id, true); setMessage('评论已审核通过。') }}><Check size={15} />通过并公开</button></div></article>)}</div> : <EmptyState title="暂无待审评论" detail="在作品阅读页提交演示评论后，可在这里审核。" />}</>}
    {tab === 'issues' && <><div className="admin-toolbar"><h2>期刊管理</h2><button className="button primary small" onClick={() => setEditingIssue(null)}><FilePlus2 size={16} />新建一期</button></div><div className="admin-issues">{issues.map(issue => <article key={issue.id}><img src={issue.cover} alt={`${issue.title}封面`} /><div><span className="small-label">VOL. {issue.number}</span><h3>{issue.title}</h3><p>{issue.status === 'draft' ? '草稿 · 未公开' : '已公开'} · {issue.workIds.filter(id => works.some(work => work.id === id && work.status === 'published')).length} 篇</p></div><div className="button-row"><button className="button small" onClick={() => setEditingIssue(issue)}>编辑</button>{issue.status === 'published' && <Link className="icon-button" to={`/issues/${issue.slug}`} aria-label={`查看${issue.title}`} title="查看期刊"><ArrowUpRight size={17} /></Link>}</div></article>)}</div></>}
    {tab === 'audit' && <><div className="admin-toolbar"><h2><History size={17} /> 操作日志</h2></div><div className="admin-list">{auditLogs.map(log => <article className="admin-row" key={log.id}><History size={16} /><div><h3>{log.action}</h3><p>{log.targetType} · {log.targetId} · {formatDate(log.createdAt)}</p></div></article>)}{!auditLogs.length && <EmptyState title="暂无操作日志" />}</div></>}
    {reviewing && <ReviewModal submission={reviewing} onClose={() => setReviewing(undefined)} />}
    {editingIssue !== undefined && <IssueEditor issue={editingIssue || undefined} onClose={() => setEditingIssue(undefined)} />}
    {withdrawing && <Modal title="撤下作品" onClose={() => setWithdrawing(undefined)}><p>撤下后，作品将从作品库、检索和期刊公开目录中移除。</p><div className="modal-actions"><button className="button" onClick={() => setWithdrawing(undefined)}>取消</button><button className="button danger" onClick={async () => { try { await withdrawWork(withdrawing); setWithdrawing(undefined); setMessage('作品已撤下，公开目录已同步更新。') } catch (error) { setMessage(error instanceof Error ? error.message : '撤下失败') } }}>确认撤下</button></div></Modal>}
  </div>
}

function AdminLogin({ password, setPassword, error, loading, onSubmit }: { password: string; setPassword: (value: string) => void; error: string; loading: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="container admin-login"><Breadcrumb items={[{ label: '审核演示' }]} /><div className="admin-login-panel"><ShieldCheck size={30} strokeWidth={1.4} /><span className="small-label">EDITORIAL DESK</span><h1>管理员登录</h1><p>管理员会话使用 HttpOnly Cookie 保存。公开读者无需登录。</p><form onSubmit={onSubmit}><label htmlFor="admin-password">管理员密码<input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label>{error && <p className="field-error" role="alert">{error}</p>}<button className="button primary" disabled={loading || !password} type="submit">{loading ? '登录中…' : '登录编辑台'}</button></form><small>本地开发密码来自 `ADMIN_PASSWORD` 环境变量。</small></div></div>
}
