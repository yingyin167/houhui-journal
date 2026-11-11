import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import * as api from './api'
import type { AuditLog, Comment, Issue, Submission, SubmissionInput, Work } from './domain'
import { initialIssues, initialWorks } from './data'

const staticPreview = import.meta.env.MODE === 'preview'

function useJournalState() {
  const [works, setWorks] = useState<Work[]>(staticPreview ? initialWorks : [])
  const [issues, setIssues] = useState<Issue[]>(staticPreview ? initialIssues : [])
  const [adminIssues, setAdminIssues] = useState<Issue[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [adminAuthenticated, setAdminAuthenticated] = useState(false)
  const [loadError, setLoadError] = useState('')

  async function refreshPublic() {
    if (staticPreview) return
    try {
      const [worksResponse, issuesResponse] = await Promise.all([api.getWorks(), api.getIssues()])
      setWorks(worksResponse.data); setIssues(issuesResponse.data); setLoadError('')
    } catch (error) { setLoadError(error instanceof Error ? error.message : '公开内容暂时无法载入') }
  }
  async function refreshAdmin() {
    const [submissionResponse, commentResponse, issueResponse, auditResponse] = await Promise.all([api.getAdminSubmissions(), api.getAdminComments(), api.getAdminIssues(), api.getAdminAuditLogs()])
    setSubmissions(submissionResponse.data); setComments(commentResponse.data); setAdminIssues(issueResponse.data); setAuditLogs(auditResponse.data)
  }
  useEffect(() => {
    if (staticPreview) return
    void refreshPublic()
    void api.adminSession().then(async () => { setAdminAuthenticated(true); await refreshAdmin() }).catch(() => setAdminAuthenticated(false))
  }, [])
  async function submit(input: SubmissionInput) {
    if (staticPreview) throw new Error('当前为只读预览版，尚未开放投稿。')
    return (await api.submitWork(input)).data.id
  }
  async function loadComments(workId: string) {
    if (staticPreview) return
    try {
      const response = await api.getComments(workId)
      setComments(previous => [...previous.filter(comment => comment.workId !== workId), ...response.data])
    } catch {
      setComments(previous => previous.filter(comment => comment.workId !== workId))
    }
  }
  async function addComment(workId: string, nickname: string, body: string) {
    if (staticPreview) throw new Error('当前为只读预览版，尚未开放评论。')
    await api.submitComment(workId, nickname.trim(), body.trim()); return true
  }
  async function login(password: string) { await api.adminLogin(password); setAdminAuthenticated(true); await refreshAdmin() }
  async function logout() { await api.adminLogout(); setAdminAuthenticated(false); setSubmissions([]); setComments([]); setAdminIssues([]); setAuditLogs([]) }
  async function reviewWork(id: string, approve: boolean, reviewNote = '') { await api.reviewSubmission(id, approve, reviewNote); await Promise.all([refreshPublic(), refreshAdmin()]) }
  async function reviewComment(id: string, approve: boolean) {
    await api.reviewComment(id, approve ? 'approved' : 'rejected')
    const workId = comments.find(comment => comment.id === id)?.workId
    if (workId) await loadComments(workId)
    await refreshAdmin()
  }
  async function saveIssue(issue: Issue) { await api.saveAdminIssue(issue); await Promise.all([refreshPublic(), refreshAdmin()]) }
  async function withdrawPublishedWork(id: string) { await api.withdrawWork(id); await Promise.all([refreshPublic(), refreshAdmin()]) }
  return { works, issues, adminIssues, submissions, comments, auditLogs, loadError, adminAuthenticated, staticPreview, refreshPublic, refreshAdmin, submit, loadComments, addComment, login, logout, reviewWork, reviewComment, saveIssue, withdrawWork: withdrawPublishedWork }
}

type JournalState = ReturnType<typeof useJournalState>
const JournalContext = createContext<JournalState | null>(null)

export function JournalProvider({ children }: { children: ReactNode }) {
  return <JournalContext.Provider value={useJournalState()}>{children}</JournalContext.Provider>
}

export function useJournal() {
  const context = useContext(JournalContext)
  if (!context) throw new Error('JournalProvider is required')
  return context
}
