import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, FilePenLine, Search, Share2, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { aiNames, excerpt, isSafeUrl, typeNames } from './domain'
import type { Work } from './domain'

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return <>
    <a className="skip-link" href="#main">跳到正文</a>
    <div className="utility"><div className="container utility-inner">
      <span>独立观察 · 跨学科思考 · 非虚构表达</span>
      <span className="utility-right"><span className="demo-dot" />本地原型 / 示例内容 <Link to="/admin">审核演示 <ArrowUpRight size={12} /></Link></span>
    </div></div>
    <header className="masthead container">
      <Link to="/" className="brand" aria-label="后会有期刊首页">
        <span className="brand-seal" aria-hidden="true">后会<br />有期</span>
        <span><strong>后会有期刊</strong><span className="brand-en">HOUHUI JOURNAL</span></span>
      </Link>
      <nav aria-label="主导航">
        <NavLink to="/" end>首页</NavLink>
        <NavLink to="/works">作品库</NavLink>
        <NavLink to="/issues">期刊</NavLink>
        <NavLink to="/about">关于</NavLink>
      </nav>
      <Link className="button primary masthead-submit" to="/submit"><FilePenLine size={16} />我要投稿</Link>
    </header>
    <main id="main">{children}</main>
    <footer className="site-footer"><div className="container footer-inner">
      <div><Link className="footer-brand" to="/">后会有期刊</Link><p>从《后会友期》出发，让观察与表达有据可循。</p></div>
      <div className="footer-links"><Link to="/guidelines">投稿须知</Link><Link to="/about">关于期刊</Link><Link to="/admin">审核演示</Link></div>
      <div className="footer-note">免费 · 无广告 · 非节目官方平台<br />本地演示，刷新后数据重置</div>
    </div></footer>
  </>
}

export function SearchForm({ initial = '', compact = false }: { initial?: string; compact?: boolean }) {
  const [query, setQuery] = useState(initial)
  const navigate = useNavigate()
  useEffect(() => setQuery(initial), [initial])
  return <form role="search" className={`search-form ${compact ? 'compact' : ''}`} onSubmit={event => {
    event.preventDefault()
    navigate(`/works${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`)
  }}>
    <Search size={20} aria-hidden="true" />
    <input aria-label="检索作品" value={query} onChange={event => setQuery(event.target.value)} placeholder="检索标题、作者、关键词或正文" maxLength={200} />
    {query && <button type="button" className="icon-button" aria-label="清空检索" title="清空检索" onClick={() => setQuery('')}><X size={16} /></button>}
    <button className="button primary" type="submit">检索<Search size={16} /></button>
  </form>
}

export function SectionHeading({ title, aside, children }: { title: string; aside?: ReactNode; children?: ReactNode }) {
  return <div className="section-heading"><div><h2>{title}</h2>{children}</div>{aside}</div>
}

export function WorkList({ works }: { works: Work[] }) {
  if (!works.length) return <EmptyState title="暂无符合条件的作品" detail="换一个关键词，或清除筛选后再看看。" />
  return <div className="work-list">{works.map((work, index) =>
    <article className="work-row" key={work.id}>
      <span className="row-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <div className="work-row-main">
        <div className="work-kicker"><span className={`type-label ${work.type}`}>{typeNames[work.type]}</span><span>{work.disciplines.join(' / ') || '非虚构文学'}</span>{work.sample && <span className="sample-label">示例</span>}</div>
        <h3><Link to={`/works/${work.id}`}>{work.title}</Link></h3>
        <p className={`work-excerpt ${work.type === 'poetry' ? 'poem-excerpt' : ''}`}>{excerpt(work)}</p>
        <div className="work-bottom"><span>{work.author}<span className="meta-divider">/</span>{formatDate(work.publishedAt)}</span><div className="tag-list">{work.tags.map(tag => <Link key={tag} to={`/works?tag=${encodeURIComponent(tag)}`}>{tag}</Link>)}</div></div>
      </div>
      <Link className="row-arrow" to={`/works/${work.id}`} aria-label={`阅读${work.title}`}><ArrowUpRight size={18} /></Link>
    </article>)}</div>
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return <div className="empty-state"><BookOpen size={26} strokeWidth={1.3} /><h3>{title}</h3>{detail && <p>{detail}</p>}</div>
}

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return <nav className="breadcrumb" aria-label="当前位置"><Link to="/">首页</Link>{items.map((item, index) =>
    <span key={index}><ChevronRight size={12} />{item.to ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}</span>)}</nav>
}

export function BodyRenderer({ body, type }: { body: string; type: Work['type'] }) {
  return <div className={`article-body ${type === 'poetry' ? 'poetry-body' : ''}`}>
    {type === 'poetry' ? body : <ReactMarkdown components={{
      img: () => null,
      a: ({ href, children }) => href && isSafeUrl(href)
        ? <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}<ArrowUpRight size={12} /></a>
        : <span>{children}</span>,
    }}>{body}</ReactMarkdown>}
  </div>
}

export function AiLabel({ work }: { work: Work }) {
  return <span className="text-badge">{aiNames[work.aiUsage]}</span>
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => { dialog?.close() }
  }, [])
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-labelledby={titleId} onCancel={onClose} onClick={event => {
    if (event.target === ref.current) {
      const box = ref.current.getBoundingClientRect()
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
    }
  }}>
    <div className="modal-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" type="button" title="关闭" aria-label="关闭" onClick={onClose}><X size={20} /></button></div>
    <div className="modal-content">{children}</div>
  </dialog>
}

export function ShareButton() {
  const [copied, setCopied] = useState(false)
  const [fallback, setFallback] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(timeout)
  }, [copied])
  return <>
    <button className="button" onClick={async () => {
      try {
        await navigator.clipboard.writeText(window.location.href)
        setCopied(true)
      } catch { setFallback(true) }
    }}>{copied ? <Check size={16} /> : <Share2 size={16} />}{copied ? '链接已复制' : '分享'}</button>
    {fallback && <Modal title="分享链接" onClose={() => setFallback(false)}><input aria-label="分享链接" readOnly value={window.location.href} onFocus={event => event.target.select()} /></Modal>}
  </>
}

export function Field({ label, name, error, required, children, hint }: { label: string; name: string; error?: string; required?: boolean; children: ReactNode; hint?: string }) {
  return <div className={`field ${error ? 'has-error' : ''}`}>
    <label htmlFor={name}>{label}{required && <span className="required"> *</span>}</label>
    {children}
    {error ? <p id={`${name}-error`} className="field-error" role="alert">{error}</p> : hint && <p className="field-hint">{hint}</p>}
  </div>
}

export function MoreLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="more-link" to={to}>{children}<ArrowRight size={15} /></Link>
}

export function formatDate(date: string) {
  if (!date || Number.isNaN(Date.parse(date))) return '待发布'
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date)).replaceAll('/', '.')
}
