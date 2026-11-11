import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, CircleCheck, Eye, FilePenLine, LockKeyhole } from 'lucide-react'
import { BodyRenderer, Breadcrumb, Field, Modal } from './components'
import { aiNames, blankSubmission, disciplines, typeNames, validateSubmission } from './domain'
import type { SubmissionInput, WorkType } from './domain'
import { useJournal } from './store'

export function SubmitPage() {
  const { submit } = useJournal()
  const [input, setInput] = useState<SubmissionInput>({ ...blankSubmission, disciplines: [] })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState(false)
  const [submitted, setSubmitted] = useState('')
  const [sending, setSending] = useState(false)
  function change<K extends keyof SubmissionInput>(key: K, value: SubmissionInput[K]) {
    setInput(previous => ({ ...previous, [key]: value }))
    setErrors(previous => { const next = { ...previous }; delete next[key]; return next })
  }
  function attrs(key: keyof SubmissionInput) {
    return { id: key, name: key, 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `${key}-error` : undefined }
  }
  function text(key: keyof SubmissionInput, maxLength?: number) {
    return { ...attrs(key), value: String(input[key]), maxLength, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(key, event.target.value as never) }
  }
  async function send(event: FormEvent) {
    event.preventDefault()
    if (sending) return
    const nextErrors = validateSubmission(input)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[name="${Object.keys(nextErrors)[0]}"]`)?.focus()
        document.querySelector('.has-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
      return
    }
    setSending(true)
    try {
      setSubmitted(await submit(input))
      window.scrollTo(0, 0)
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : '投稿暂时失败，请稍后重试。' })
    } finally {
      setSending(false)
    }
  }
  if (submitted) return <div className="container submission-success">
    <CircleCheck size={42} strokeWidth={1.2} /><span className="small-label">LOCAL DEMONSTRATION</span><h1>演示稿已进入待审列表</h1>
    <p>已保存到本地开发服务器的待审队列，未发送到编辑邮箱。<br />管理员审核通过后才会公开。</p>
    <dl><dt>作品</dt><dd>{input.title}</dd><dt>演示编号</dt><dd className="receipt-id">{submitted}</dd><dt>当前状态</dt><dd>待审核 · 尚未公开</dd></dl>
    <div className="button-row"><Link className="button primary" to="/admin">查看审核演示<ArrowRight size={16} /></Link><button className="button" onClick={() => { setSubmitted(''); setInput({ ...blankSubmission, disciplines: [] }); setErrors({}) }}>再写一篇</button><Link className="text-link" to="/works">回到作品库</Link></div>
  </div>
  return <div className="container"><Breadcrumb items={[{ label: '投稿' }]} /><div className="page-heading"><div><span className="small-label">CONTRIBUTE TO THE JOURNAL</span><h1>投稿</h1></div><Link className="more-link" to="/guidelines">投稿须知<ArrowRight size={15} /></Link></div>
    <div className="submission-grid"><form className="submission-form" onSubmit={send} noValidate>
      <div className="local-banner"><span className="demo-dot" /><span>本地开发收稿 · 已保存到 SQLite，不发送邮件，请勿填写真实敏感信息。</span></div>
      <section className="form-section"><div className="form-section-heading"><span>01</span><h2>作品信息</h2></div>
        <fieldset className="type-choice"><legend>投稿类型</legend>{Object.entries(typeNames).map(([value, name]) => <label key={value} className={input.type === value ? 'checked' : ''}><input type="radio" name="type" value={value} checked={input.type === value} onChange={() => change('type', value as WorkType)} />{name}{input.type === value && <Check size={15} />}</label>)}</fieldset>
        <Field label="作品标题" name="title" required error={errors.title}><input {...text('title', 120)} autoComplete="off" /></Field>
        <div className="field-grid"><Field label={input.rights === 'authorized_reprint' ? '投稿人笔名' : '作者笔名'} name="author" required error={errors.author}><input {...text('author', 40)} autoComplete="nickname" /></Field>
          <Field label="私密联系邮箱" name="email" required error={errors.email} hint="仅用于审核联系，不随作品公开。"><input {...text('email', 254)} type="email" autoComplete="off" /></Field></div>
        {input.type === 'analysis' ? <>
          <Field label="摘要" name="summary" required error={errors.summary}><textarea {...text('summary', 600)} rows={4} /></Field>
          <Field label="学科视角" name="disciplines" required error={errors.disciplines} hint="选择 1–3 个学科。"><div className="checkbox-grid" id="disciplines">{disciplines.map(discipline => <label key={discipline}><input name="disciplines" type="checkbox" checked={input.disciplines.includes(discipline)} onChange={event => change('disciplines', event.target.checked ? [...input.disciplines, discipline] : input.disciplines.filter(d => d !== discipline))} />{discipline}</label>)}</div></Field>
        </> : <Field label="真实写作依据" name="basis" required error={errors.basis} hint="说明真实节目材料，或本人真实经历及其与节目的关联。"><textarea {...text('basis', 1000)} rows={4} /></Field>}
        <Field label="关键词" name="tags" error={errors.tags} hint="最多 5 个，用逗号分隔。"><input {...text('tags', 120)} /></Field>
      </section>
      <section className="form-section"><div className="form-section-heading"><span>02</span><h2>正文与材料</h2><button className="button small" type="button" onClick={() => setPreview(true)}><Eye size={15} />阅读预览</button></div>
        <Field label="正文" name="body" required error={errors.body} hint={input.type === 'poetry' ? '保留诗行与空行。' : '支持基础 Markdown；不接收图片与附件。'}><textarea aria-label="正文" className="body-editor" {...text('body', 50000)} rows={15} /></Field>
        <Field label="节目期数与材料出处" name="episode"><textarea {...text('episode', 2000)} rows={2} /></Field>
        <Field label="参考资料" name="references"><textarea {...text('references', 5000)} rows={3} /></Field>
        <Field label="作者说明" name="note"><textarea {...text('note', 2000)} rows={2} /></Field>
        <label className="check-line"><input type="checkbox" checked={input.spoiler} onChange={event => change('spoiler', event.target.checked)} />正文涉及具体节目内容，需要剧透提醒</label>
      </section>
      <section className="form-section"><div className="form-section-heading"><span>03</span><h2>来源与声明</h2></div>
        <fieldset className="radio-field"><legend>内容来源</legend><label><input type="radio" name="rights" checked={input.rights === 'original'} onChange={() => change('rights', 'original')} />原创投稿</label><label><input type="radio" name="rights" checked={input.rights === 'authorized_reprint'} onChange={() => change('rights', 'authorized_reprint')} />授权转载</label></fieldset>
        {input.rights === 'authorized_reprint' && <div className="conditional-fields">
          <Field label="原作者署名" name="sourceAuthor" required error={errors.sourceAuthor}><input {...text('sourceAuthor', 80)} /></Field>
          <Field label="原文地址" name="sourceUrl" required error={errors.sourceUrl}><input {...text('sourceUrl', 2000)} type="url" /></Field>
          <Field label="授权说明" name="authorization" required error={errors.authorization} hint="说明授权来源及范围，包括本站展示与期刊收录；由编辑人工核实。"><textarea {...text('authorization', 5000)} rows={4} /></Field>
        </div>}
        <Field label="AI 使用情况" name="aiUsage"><select {...attrs('aiUsage')} value={input.aiUsage} onChange={event => change('aiUsage', event.target.value as SubmissionInput['aiUsage'])}>{Object.entries(aiNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></Field>
        {input.aiUsage !== 'none' && <Field label="AI 工具与使用环节" name="aiDetail" required error={errors.aiDetail}><textarea {...text('aiDetail', 2000)} rows={3} /></Field>}
        {input.type !== 'analysis' && <div className={errors.nonfiction ? 'field has-error' : 'field'}><label className="check-line"><input {...attrs('nonfiction')} type="checkbox" checked={input.nonfiction} onChange={event => change('nonfiction', event.target.checked)} />我确认作品基于事实或本人真实经历，不包含虚构剧情、对话或人物心理。</label>{errors.nonfiction && <p id="nonfiction-error" role="alert" className="field-error">{errors.nonfiction}</p>}</div>}
        <div className={errors.consent ? 'field has-error' : 'field'}><label className="check-line"><input {...attrs('consent')} type="checkbox" checked={input.consent} onChange={event => change('consent', event.target.checked)} /><span>我已阅读<Link className="text-link" to="/guidelines" target="_blank">投稿须知</Link>，确认事实、来源和必要授权，知悉作品与评论均经人工审核后公开。</span></label>{errors.consent && <p id="consent-error" role="alert" className="field-error">{errors.consent}</p>}</div>
      </section>
      <div className="submit-bar"><span className="muted"><LockKeyhole size={14} />无需注册 · 邮箱不公开</span><button className="button primary" type="submit" disabled={sending}><FilePenLine size={16} />提交演示稿</button></div>
      {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
    </form><aside className="submission-aside"><h2>在落款之前</h2><p>选一个你真正想分析的现象，或写一段有真实来处的表达。</p><ol><li><strong>自主选题</strong><span>不需要回答统一命题。</span></li><li><strong>保留材料边界</strong><span>让事实、解释与感受各有位置。</span></li><li><strong>文学不等于虚构</strong><span>接受诗歌、散文，不收同人文。</span></li><li><strong>公开需要审核</strong><span>进入作品库不以入选期刊为条件。</span></li></ol><Link className="more-link" to="/guidelines">完整投稿须知<ArrowRight size={15} /></Link></aside></div>
    {preview && <Modal title="阅读预览" onClose={() => setPreview(false)} wide><span className="type-label">{typeNames[input.type]}</span><h1 className="preview-title">{input.title || '未命名作品'}</h1><p className="muted">{input.rights === 'authorized_reprint' ? input.sourceAuthor || '原作者' : input.author || '作者笔名'}</p>{input.summary && input.type === 'analysis' && <div className="abstract"><h2>摘要</h2><p>{input.summary}</p></div>}<BodyRenderer type={input.type} body={input.body || '正文尚未填写。'} /></Modal>}
  </div>
}
