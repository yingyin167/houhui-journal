import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, BookMarked, ChevronLeft, ChevronRight, CircleCheck, FileText, MessageSquare, Quote, SlidersHorizontal } from 'lucide-react'
import { AiLabel, BodyRenderer, Breadcrumb, EmptyState, Layout, MoreLink, SearchForm, SectionHeading, ShareButton, WorkList, formatDate } from './components'
import { disciplines, filterWorks, issueWorks, publicWorks, typeNames } from './domain'
import { useJournal } from './store'

const SubmitPage = lazy(() => import('./SubmitPage').then(module => ({ default: module.SubmitPage })))
const AdminPage = lazy(() => import('./AdminPage').then(module => ({ default: module.AdminPage })))

function DisciplineMenu({ selected = '' }: { selected?: string }) {
  const { works } = useJournal()
  return <aside className="discipline-sidebar"><h2><SlidersHorizontal size={15} />学科索引</h2>
    <Link className={!selected ? 'selected' : ''} to="/works"><span>全部学科</span><span>{publicWorks(works).filter(w => w.type === 'analysis').length}</span></Link>
    {disciplines.map(discipline => <Link className={selected === discipline ? 'selected' : ''} key={discipline} to={`/works?type=analysis&discipline=${encodeURIComponent(discipline)}`}>
      <span>{discipline}</span><span>{publicWorks(works).filter(w => w.disciplines.includes(discipline)).length}</span>
    </Link>)}
    <div className="sidebar-literature"><h2><Quote size={15} />文学阅读</h2><Link to="/works?type=poetry">诗歌<ArrowUpRight size={14} /></Link><Link to="/works?type=prose">散文<ArrowUpRight size={14} /></Link></div>
    <div className="sidebar-note"><span className="small-label">EDITORIAL NOTE</span><p>理解可以有不同路径，<br />表达需要真实的来处。</p><MoreLink to="/guidelines">收稿边界</MoreLink></div>
  </aside>
}

function TypeTabs({ type = '', onChange }: { type?: string; onChange: (type: string) => void }) {
  return <div className="type-tabs" role="group" aria-label="作品类型">
    {[['', '全部作品'], ...Object.entries(typeNames)].map(([value, label]) => <button key={value} className={type === value ? 'active' : ''} onClick={() => onChange(value)} aria-pressed={type === value}>{label}</button>)}
  </div>
}

function HomePage() {
  const { works, issues } = useJournal()
  const [type, setType] = useState('')
  const recent = filterWorks(works, new URLSearchParams(type ? { type } : {}))
  const issue = issues.find(item => item.status === 'published')
  if (!works.length && !issues.length) return <div className="container page-loading">正在载入公开内容…</div>
  return <>
    <section className="search-band"><div className="container search-band-inner">
      <div className="search-title"><span className="small-label">A JOURNAL OF OBSERVATION</span><h1>观看之后，继续思考。</h1></div>
      <div className="search-block"><SearchForm /><div className="hot-terms"><span>主题索引</span>{['关系', '倾听', '边界', '语言'].map(tag => <Link key={tag} to={`/works?tag=${encodeURIComponent(tag)}`}>{tag}</Link>)}</div></div>
    </div></section>
    <div className="container home-grid">
      <DisciplineMenu />
      <section className="feed"><SectionHeading title="最新发表" aside={<span className="muted count">{publicWorks(works).length} 篇作品</span>}><span className="small-label">RECENT PUBLICATIONS</span></SectionHeading>
        <TypeTabs type={type} onChange={setType} /><WorkList works={recent.slice(0, 5)} /><div className="feed-more"><MoreLink to={type ? `/works?type=${type}` : '/works'}>浏览全部作品</MoreLink></div>
      </section>
      <aside className="issue-sidebar"><SectionHeading title="本期刊物" aside={<span className="small-label">CURRENT ISSUE</span>} />
        {issue ? <><Link className="cover-link" to={`/issues/${issue.slug}`}><img className="issue-cover" src={issue.cover} alt={`后会有期刊第 ${issue.number} 期：${issue.title}，排版样刊封面`} /></Link>
          <div className="issue-caption"><span className="small-label">VOL. {issue.number} <span className="sample-label">排版样刊</span></span><h3><Link to={`/issues/${issue.slug}`}>{issue.title}</Link></h3><p>{issue.description}</p><MoreLink to={`/issues/${issue.slug}`}>阅读本期 <span className="muted">/ {issueWorks(issue, works).length} 篇</span></MoreLink></div></>
          : <EmptyState title="首期筹备中" />}
        <div className="submission-call"><FileText size={21} strokeWidth={1.4} /><h3>给观察一个落款</h3><div className="submission-types">观察与研究 / 诗歌 / 散文</div><Link to="/submit">投稿<ArrowRight size={16} /></Link></div>
        <Link className="guidelines-link" to="/guidelines">投稿须知与内容边界<ArrowUpRight size={14} /></Link>
      </aside>
    </div>
    <section className="bottom-band"><div className="container bottom-band-inner"><BookMarked size={25} strokeWidth={1.4} /><div><h2>不同的视角，同一本期刊。</h2><p>自主选题，跨学科分析；也为真实的诗意与个人经验留一页。</p></div><MoreLink to="/about">关于我们</MoreLink></div></section>
  </>
}

function WorksPage() {
  const { works } = useJournal()
  const [params, setParams] = useSearchParams()
  const filtered = filterWorks(works, params)
  if (!works.length) return <div className="container page-loading">正在载入作品库…</div>
  const pageSize = 6
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.max(1, Math.min(Number(params.get('page')) || 1, pageCount))
  function update(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    if (key !== 'page') next.delete('page')
    if (key === 'type' && value !== 'analysis') next.delete('discipline')
    setParams(next)
  }
  return <div className="container">
    <Breadcrumb items={[{ label: '作品库' }]} />
    <div className="page-heading"><div><span className="small-label">PUBLICATION INDEX</span><h1>作品库</h1></div><SearchForm compact initial={params.get('q') || ''} /></div>
    <div className="library-grid"><DisciplineMenu selected={params.get('discipline') || ''} /><section className="feed">
      <div className="results-heading"><TypeTabs type={params.get('type') || ''} onChange={value => update('type', value)} /><span className="muted">共 {filtered.length} 篇 · 最新发表</span></div>
      {(params.get('q') || params.get('discipline') || params.get('tag')) && <div className="active-filters"><span>当前检索</span>{['q', 'discipline', 'tag'].filter(key => params.get(key)).map(key => <button key={key} onClick={() => update(key, '')}>{params.get(key)}<span aria-hidden="true"> ×</span><span className="sr-only">清除</span></button>)}<button className="clear-filters" onClick={() => setParams({})}>清除全部</button></div>}
      <WorkList works={filtered.slice((page - 1) * pageSize, page * pageSize)} />
      {pageCount > 1 && <nav className="pagination" aria-label="分页"><button className="icon-button" title="上一页" aria-label="上一页" disabled={page === 1} onClick={() => update('page', String(page - 1))}><ChevronLeft size={18} /></button>{Array.from({ length: pageCount }, (_, i) => <button key={i} className={page === i + 1 ? 'active' : ''} aria-current={page === i + 1 ? 'page' : undefined} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(i + 1)); setParams(next) }}>{i + 1}</button>)}<button className="icon-button" title="下一页" aria-label="下一页" disabled={page === pageCount} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page + 1)); setParams(next) }}><ChevronRight size={18} /></button></nav>}
    </section></div>
  </div>
}

function Comments({ workId }: { workId: string }) {
  const { comments, addComment, loadComments } = useJournal()
  const [nickname, setNickname] = useState('')
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { void loadComments(workId) }, [workId])
  const visible = comments.filter(comment => comment.workId === workId && comment.status === 'approved')
  return <section className="comments-section"><SectionHeading title="讨论" aside={<span className="muted">{visible.length} 条公开评论</span>} />
    {visible.length ? <div className="comments-list">{visible.map(comment => <article key={comment.id}><strong>{comment.nickname}</strong><p>{comment.body}</p></article>)}</div> : <p className="empty-comment">还没有公开评论。</p>}
    <form className="comment-form" onSubmit={async event => {
      event.preventDefault()
      if (!nickname.trim() || !body.trim()) { setError('请填写笔名和评论内容。'); return }
      try {
        await addComment(workId, nickname, body)
        setSent(true); setBody(''); setError('')
      } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : '评论提交失败，请稍后重试。') }
    }}>
      <h3><MessageSquare size={17} />留下你的思考</h3>
      <label htmlFor="comment-nickname">笔名<input id="comment-nickname" required maxLength={40} value={nickname} onChange={event => setNickname(event.target.value)} autoComplete="nickname" /></label>
      <label htmlFor="comment-body">评论<textarea id="comment-body" required maxLength={2000} rows={4} value={body} onChange={event => setBody(event.target.value)} /></label>
      <div className="form-bottom"><span className="muted">评论经人工审核后公开。</span><button className="button primary" type="submit">提交评论<ArrowRight size={15} /></button></div>
      {error && <p role="alert" className="field-error">{error}</p>}
      {sent && <div className="success-note" role="status"><CircleCheck size={17} />评论已保存到待审队列，尚未公开，管理员审核通过后才会显示。</div>}
    </form>
  </section>
}

function WorkPage() {
  const { id } = useParams()
  const { works, issues } = useJournal()
  const work = works.find(item => item.id === id && item.status === 'published')
  if (!work) return <NotFound />
  return <div className="container reading-container"><Breadcrumb items={[{ label: '作品库', to: '/works' }, { label: typeNames[work.type] }]} />
    <div className="reading-grid"><article className="reading-main">
      <div className="article-kicker"><span className={`type-label ${work.type}`}>{typeNames[work.type]}</span>{work.disciplines.map(d => <Link to={`/works?type=analysis&discipline=${encodeURIComponent(d)}`} key={d}>{d}</Link>)}</div>
      <h1 className="article-title">{work.title}</h1>
      <div className="article-meta"><span>{work.author}</span><span>{formatDate(work.publishedAt)}</span><AiLabel work={work} /><ShareButton /></div>
      {work.sample && <div className="sample-notice">本地演示作品，不是真实投稿或已核实的节目分析。</div>}
      {work.spoiler && <p className="spoiler-notice">含节目内容 / 剧透提醒</p>}
      {work.summary && <div className="abstract"><h2>摘要</h2><p>{work.summary}</p></div>}
      <BodyRenderer body={work.body} type={work.type} />
      {work.basis && <div className="article-appendix"><h2>写作依据</h2><p>{work.basis}</p></div>}
      {work.note && <div className="article-appendix"><h2>作者说明</h2><p>{work.note}</p></div>}
      {work.episode && <div className="article-appendix"><h2>节目材料</h2><p>{work.episode}</p></div>}
      {work.references && <div className="article-appendix"><h2>参考资料</h2><p>{work.references}</p></div>}
      {work.rights === 'authorized_reprint' && <div className="article-appendix"><h2>授权转载</h2><p>原作者：{work.sourceAuthor} · <a href={work.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">原文来源<ArrowUpRight size={12} /></a></p></div>}
      <div className="article-tags"><span>关键词</span>{work.tags.map(tag => <Link to={`/works?tag=${encodeURIComponent(tag)}`} key={tag}>{tag}</Link>)}</div>
      <Comments key={work.id} workId={work.id} />
    </article><aside className="reading-aside"><h2>阅读信息</h2><dl><dt>体裁</dt><dd>{typeNames[work.type]}</dd><dt>字数</dt><dd>{Array.from(work.body).length.toLocaleString()} 字</dd><dt>内容来源</dt><dd>{work.rights === 'original' ? '原创投稿' : '授权转载'}</dd></dl>
      {issues.filter(issue => issue.status === 'published' && issue.workIds.includes(work.id)).map(issue => <div className="included-issue" key={issue.id}><span className="small-label">收录于</span><Link to={`/issues/${issue.slug}`}><img src={issue.cover} alt={`${issue.title}封面`} /><span>第 {issue.number} 期<br /><strong>{issue.title}</strong></span><ArrowUpRight size={16} /></Link></div>)}
      <MoreLink to="/works">返回作品库</MoreLink>
    </aside></div>
  </div>
}

function IssuesPage() {
  const { issues, works } = useJournal()
  const published = issues.filter(issue => issue.status === 'published')
  return <div className="container"><Breadcrumb items={[{ label: '期刊' }]} /><div className="page-heading"><div><span className="small-label">JOURNAL ARCHIVE</span><h1>期刊</h1></div><span className="muted">{published.length} 期刊物</span></div>
    <div className="issue-archive">{published.map(issue => <article className="archive-item" key={issue.id}><Link to={`/issues/${issue.slug}`}><img src={issue.cover} alt={`${issue.title}封面`} /></Link><div><span className="small-label">VOL. {issue.number} / {formatDate(issue.publishedAt)}</span><h2><Link to={`/issues/${issue.slug}`}>{issue.title}</Link></h2><span className="text-badge">{issue.sample ? '排版样刊' : '精选期刊'}</span><p>{issue.description}</p><p className="muted">{issueWorks(issue, works).length} 篇作品</p><MoreLink to={`/issues/${issue.slug}`}>阅读本期</MoreLink></div></article>)}</div>
    {!published.length && <EmptyState title="首期筹备中" />}
  </div>
}

function IssuePage() {
  const { slug } = useParams()
  const { issues, works } = useJournal()
  const issue = issues.find(item => item.slug === slug && item.status === 'published')
  if (!issue) return <NotFound />
  const contents = issueWorks(issue, works)
  return <div className="container"><Breadcrumb items={[{ label: '期刊', to: '/issues' }, { label: `第 ${issue.number} 期` }]} />
    <section className="issue-feature"><img src={issue.cover} alt={`${issue.title}封面`} /><div className="issue-feature-copy"><span className="small-label">HOUHUI JOURNAL / VOL. {issue.number}</span><h1>{issue.title}</h1><p className="issue-description">{issue.description}</p><div className="issue-feature-meta"><span>{formatDate(issue.publishedAt)} · {contents.length} 篇作品</span>{issue.sample && <span className="text-badge">排版样刊</span>}</div><div className="editorial"><h2>卷首语</h2><p>{issue.editorial}</p></div><div className="button-row"><a className="button primary" href="#issue-contents">本期目录<ArrowDown size={15} /></a><ShareButton /></div></div></section>
    <section className="issue-contents" id="issue-contents"><SectionHeading title="本期目录" aside={<span className="small-label">CONTENTS</span>} />{Object.entries(typeNames).map(([type, name]) => contents.some(work => work.type === type) && <div className="contents-group" key={type}><h2>{name}<span>{contents.filter(work => work.type === type).length} 篇</span></h2><WorkList works={contents.filter(work => work.type === type)} /></div>)}</section>
  </div>
}

export function RulesContent() {
  return <div className="rules-content">
    <h2>收什么</h2><p>围绕《后会友期》自主选题：心理学、教育学、社会学、文学与语言、自然科学、数学与计算等视角的观察与研究，以及基于事实的诗歌、散文。可以写节目引发的作者本人真实经历，并说明两者的关联。</p>
    <h2>事实与表达的边界</h2><p>不收同人文、虚构情节、想象的对话或人物心理。可以使用比喻，但不能让读者把想象当成事实。请区分节目中可见的材料、个人解释和仍然未知的部分；不对真实人物作远程诊断。</p>
    <h2>AI 与转载</h2><p>接受 AI 生成部分或全部主体内容，须说明工具及使用环节；作者仍需核实事实与来源。接受授权转载，须保留原作者署名、原文来源，并提供涵盖本站展示与期刊收录的授权说明，由编辑人工核实。</p>
    <h2>署名与隐私</h2><p>无需注册，可使用笔名；投稿必须填写私密联系邮箱，不随文章公开。涉及他人真实经历时，请妥善匿名并确认必要的同意，不提交可识别的敏感隐私。</p>
    <h2>审核与发表</h2><p>投稿经人工审核后可进入作品库，不以入选期刊为前提。期刊由编辑人工精选。首版评论开放，所有评论人工审核后公开。阅读、投稿与评论均免费，无广告。</p>
  </div>
}

function InfoPage({ guidelines = false }: { guidelines?: boolean }) {
  return <div className="container info-container"><Breadcrumb items={[{ label: guidelines ? '投稿须知' : '关于期刊' }]} /><div className="page-heading"><div><span className="small-label">{guidelines ? 'SUBMISSION GUIDELINES' : 'ABOUT THE JOURNAL'}</span><h1>{guidelines ? '投稿须知' : '后会有期刊'}</h1></div></div>
    {!guidelines && <div className="about-intro"><p>一份从综艺观看出发的独立网络刊物。</p><p>我们关心节目中的社会现象，也关心观看如何与真实生活发生联系。分析可以借助不同学科，表达也可以是一首诗、一篇散文。选题由作者决定，而不是由平台先给出一道题。</p><p>作品库承载日常发表，期刊留下阶段性的精选。本站非节目官方平台，与任何品牌均无已声明的赞助或授权关系。</p></div>}
    <RulesContent /><div className="local-disclaimer"><strong>当前版本：本地全栈开发基线</strong><p>页面中的预置作品、作者与期刊均为示例。投稿、评论、审核和期刊会保存到本地 SQLite；尚未接入正式运营邮箱、备份、部署和生产管理流程。请勿输入真实敏感信息。</p></div><Link className="button primary" to="/submit">前往投稿<ArrowRight size={16} /></Link>
  </div>
}

function NotFound() {
  return <div className="container not-found"><span className="small-label">404 / NOT FOUND</span><h1>这一页暂未收录。</h1><p>内容可能尚未公开、已经撤下，或地址不正确。</p><Link to="/works" className="button primary">返回作品库<ArrowRight size={16} /></Link></div>
}

export default function App() {
  const { staticPreview } = useJournal()
  return <Layout>{staticPreview && <div className="static-preview-notice" role="status">只读预览版：展示样例内容，投稿、评论和管理功能尚未启用。</div>}<Suspense fallback={<div className="container page-loading" role="status">正在载入…</div>}><Routes><Route path="/" element={<HomePage />} /><Route path="/works" element={<WorksPage />} /><Route path="/works/:id" element={<WorkPage />} /><Route path="/issues" element={<IssuesPage />} /><Route path="/issues/:slug" element={<IssuePage />} /><Route path="/submit" element={<SubmitPage />} /><Route path="/admin" element={<AdminPage />} /><Route path="/guidelines" element={<InfoPage guidelines />} /><Route path="/about" element={<InfoPage />} /><Route path="*" element={<NotFound />} /></Routes></Suspense></Layout>
}
