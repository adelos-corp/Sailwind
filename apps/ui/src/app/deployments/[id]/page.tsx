'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { deployments, type Deployment, type DeploymentEvent, type LogEntry } from '@/lib/api'
import ThoughtLine from '@/components/react-bits/ThoughtLine'

interface StageUpdate { stage: string; stageStatus: 'RUNNING' | 'DONE' | 'FAILED'; [k: string]: unknown }
interface DiagnosisInfo {
  failureType: string; rootCause: string; proposedCorrectionJson: string
  confidence: number; rationale: string; id: string
}
interface Plan { imageTag: string; port: number; healthPath: string; steps: string[] }
interface CheckResult { name: string; status: string; message: string }

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending', ANALYZING: 'Analyzing', CHECKING: 'Pre-Checks',
  AWAITING_APPROVAL: 'Awaiting Approval', DEPLOYING: 'Deploying',
  VERIFYING: 'Verifying', LIVE: 'Live', FAILED: 'Failed',
  CORRECTING: 'Auto-Correcting', TERMINAL: 'Terminated',
}
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'border-slate-200 bg-slate-50 text-slate-600',
  ANALYZING: 'border-blue-200 bg-blue-50 text-blue-700',
  CHECKING: 'border-blue-200 bg-blue-50 text-blue-700',
  AWAITING_APPROVAL: 'border-amber-200 bg-amber-50 text-amber-700',
  DEPLOYING: 'border-blue-200 bg-blue-50 text-blue-700',
  VERIFYING: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  LIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  FAILED: 'border-rose-200 bg-rose-50 text-rose-700',
  CORRECTING: 'border-violet-200 bg-violet-50 text-violet-700',
  TERMINAL: 'border-rose-200 bg-rose-50 text-rose-700',
}
const TERMINAL_STATUSES = new Set(['LIVE', 'TERMINAL'])

export default function DeploymentPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [deployment, setDeployment] = useState<Deployment | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stages, setStages] = useState<Record<string, StageUpdate>>({})
  const [plan, setPlan] = useState<Plan | null>(null)
  const [checks, setChecks] = useState<CheckResult[] | null>(null)
  const [diagnosis, setDiagnosis] = useState<DiagnosisInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    deployments.get(id).then(({ deployment: d }) => setDeployment(d)).catch(e => setError(e.message))
    deployments.getLogs(id).then(({ logs: l }) => setLogs(l)).catch(() => {})
    deployments.getPlan(id).then(r => { if (r.plan) setPlan(r.plan) }).catch(() => {})
    deployments.getChecks(id).then(r => { if (r.report) setChecks(r.report.checks) }).catch(() => {})
    deployments.getDiagnosis(id).then(r => { if (r.diagnosis) setDiagnosis(r.diagnosis) }).catch(() => {})
  }, [id])

  useEffect(() => {
    if (!deployment || TERMINAL_STATUSES.has(deployment.status)) return
    const es = deployments.streamEvents(id, (event: DeploymentEvent) => {
      if (event.type === 'status') {
        const newStatus = event.payload.status as string
        setDeployment(prev => prev ? { ...prev, status: newStatus as Deployment['status'] } : prev)
        if (newStatus === 'AWAITING_APPROVAL') {
          deployments.getPlan(id).then(r => { if (r.plan) setPlan(r.plan) }).catch(() => {})
          deployments.getChecks(id).then(r => { if (r.report) setChecks(r.report.checks) }).catch(() => {})
        }
        if (newStatus === 'FAILED') deployments.getDiagnosis(id).then(r => { if (r.diagnosis) setDiagnosis(r.diagnosis) }).catch(() => {})
      }
      if (event.type === 'stage') {
        const s = event.payload as unknown as StageUpdate
        setStages(prev => ({ ...prev, [s.stage]: s }))

        // The FAILED status can arrive before the diagnosis has been persisted.
        // Refreshing only on status therefore creates a race where the recovery
        // decision is missing until the user reloads the page. Once the diagnosis
        // stage settles, fetch the persisted diagnosis again.
        if (s.stage === 'diagnosis' && s.stageStatus === 'DONE') {
          deployments.getDiagnosis(id)
            .then(r => { if (r.diagnosis) setDiagnosis(r.diagnosis) })
            .catch(() => {})
        }
      }
      if (event.type === 'log') setLogs(prev => [...prev, event.payload as unknown as LogEntry])
    }, () => {})
    return () => es.close()
  }, [id, deployment?.status])

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])

  const handleApproval = useCallback(async (gate: 'DEPLOY' | 'CORRECT', decision: 'APPROVED' | 'REJECTED') => {
    if (!deployment) return
    setApproving(true)
    try {
      await deployments.approve(id, { gate, decision })
      const { deployment: updated } = await deployments.get(id)
      setDeployment(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed')
    } finally { setApproving(false) }
  }, [id, deployment])

  if (error) return <PageShell><div className="sailwind-card p-10 text-center"><div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">!</div><p className="text-sm font-semibold text-slate-800">{error}</p><button onClick={() => router.push('/')} className="mt-4 text-xs font-semibold text-blue-600">← Back to control plane</button></div></PageShell>
  if (!deployment) return <PageShell><div className="sailwind-card p-12 text-center"><div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" /><p className="text-xs text-slate-500">Loading deployment telemetry…</p></div></PageShell>

  const statusLabel = STATUS_LABEL[deployment.status] ?? deployment.status
  const statusColor = STATUS_COLOR[deployment.status] ?? STATUS_COLOR.PENDING
  const isTerminal = TERMINAL_STATUSES.has(deployment.status)
  const graniteThinking = stages.diagnosis?.stageStatus === 'RUNNING'
  const graniteFallback = Boolean(stages.diagnosis?.usedFallback)
  let diagnosisCorrection: { diff?: string } | null = null
  if (diagnosis) {
    try { diagnosisCorrection = JSON.parse(diagnosis.proposedCorrectionJson) } catch { diagnosisCorrection = null }
  }

  return (
    <PageShell>
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-700">Overview</Link><span>›</span>
        <Link href="/projects" className="hover:text-slate-700">Projects</Link><span>›</span>
        <span className="font-medium text-slate-700">Deployment {id.slice(0, 8)}</span>
      </div>

      <section className="sailwind-card mb-4 overflow-hidden">
        <div className="flex flex-col justify-between gap-5 px-6 py-6 sm:flex-row sm:items-start lg:px-7">
          <div>
            <div className="flex items-center gap-2">
              <p className="sailwind-eyebrow">Deployment record</p>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">#{deployment.attemptNumber}</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Deployment {id.slice(0, 8)}</h1>
            <p className="sailwind-mono mt-1 text-[10px] text-slate-400">{deployment.id}</p>
          </div>
          <div className="text-left sm:text-right">
            <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${statusColor}`}>
              <span className="mr-1.5">{deployment.status === 'LIVE' ? '●' : '○'}</span>{statusLabel}
            </span>
            {deployment.completedAt && <p className="mt-2 text-[10px] text-slate-400">Completed {new Date(deployment.completedAt).toLocaleString()}</p>}
          </div>
        </div>

        {deployment.status === 'LIVE' && (
          <div className="border-t border-emerald-100 bg-emerald-50/70 px-6 py-5 lg:px-7">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">✓</div>
                <div><p className="text-sm font-semibold text-emerald-900">Deployment verified and live</p><p className="text-xs text-emerald-700">Health check passed. The container is running and serving traffic.</p></div>
              </div>
              {deployment.containerId && <div className="text-[10px] text-emerald-700 sm:text-right"><p className="font-semibold uppercase tracking-wider">Container</p><p className="sailwind-mono mt-0.5">{deployment.containerId.slice(0, 12)}</p></div>}
            </div>
          </div>
        )}
      </section>

      <StageTracker stages={stages} status={deployment.status} />

      {(graniteThinking || stages.diagnosis?.stageStatus === 'DONE') && (
        <section className="sailwind-card mb-4 px-5 py-4">
          <ThoughtLine
            working={graniteThinking}
            steps={['Reading deployment logs', 'Analyzing the failure', 'Preparing a bounded correction']}
            label="Granite is thinking…"
            doneLabel={graniteFallback ? 'Fallback diagnosis completed' : 'Granite analyzed the failure'}
            glyph="sparkle"
            color="#f8fafc"
            glyphColor="#8ab4f8"
            fontSize={14}
            breathPeriod={1.6}
            breathDepth={0.45}
            settleDuration={350}
            settleBlur={2}
            collapsible
            collapseOnSettle
            showTimer
          />
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <div className="space-y-4">
          {checks && checks.length > 0 && (
            <section className="sailwind-card p-5">
              <SectionTitle eyebrow="Safety checks" title="Pre-deployment assessment" />
              <div className="mt-5 divide-y divide-slate-100">
                {checks.map(c => (
                  <div key={c.name} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className={`mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full text-[9px] font-bold ${c.status === 'PASS' ? 'bg-emerald-100 text-emerald-700' : c.status === 'WARN' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{c.status === 'PASS' ? '✓' : c.status === 'WARN' ? '!' : '×'}</span>
                    <div><p className="text-xs font-semibold text-slate-800">{c.name}</p><p className="mt-0.5 text-[11px] leading-4 text-slate-500">{c.message}</p></div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {plan && (
            <section className="sailwind-card overflow-hidden">
              <div className="p-5">
                <SectionTitle eyebrow="Execution plan" title="Deployment plan" />
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <Metric label="Image" value={plan.imageTag} mono />
                  <Metric label="Port" value={`${plan.port} → ${plan.port + 10000}`} mono />
                  <Metric label="Health" value={plan.healthPath} mono />
                </div>
              </div>
              <div className="border-t border-slate-100 bg-slate-950 px-5 py-4">
                {plan.steps.map((s, i) => <div key={i} className="sailwind-mono flex gap-3 text-[10px] leading-6 text-slate-300"><span className="text-slate-600">{String(i + 1).padStart(2, '0')}</span><span className="break-all">{s}</span></div>)}
              </div>
            </section>
          )}

          {deployment.status === 'AWAITING_APPROVAL' && (
            <ApprovalCard title="Approval required" eyebrow="Gate 01 · Deploy" tone="amber" copy="Analysis and safety checks are complete. Review the execution plan before allowing Sailwind to perform the deployment." approving={approving} approveLabel="Approve deployment" onApprove={() => handleApproval('DEPLOY', 'APPROVED')} onReject={() => handleApproval('DEPLOY', 'REJECTED')} />
          )}

          {deployment.status === 'FAILED' && diagnosis && (
            <section className="rounded-2xl border border-orange-200 bg-orange-50/70 p-5">
              <p className="sailwind-eyebrow text-orange-700">Gate 02 · Recovery decision</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-orange-950">Failure diagnosed</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Metric label="Classification" value={diagnosis.failureType} />
                <Metric label="Confidence" value={`${Math.round(diagnosis.confidence * 100)}%`} />
              </div>
              <div className="mt-4 space-y-2 text-xs text-orange-900">
                <p><span className="font-semibold">Root cause:</span> {diagnosis.rootCause}</p>
                <p><span className="font-semibold">Rationale:</span> {diagnosis.rationale}</p>
              </div>
              {diagnosisCorrection?.diff && <pre className="sailwind-mono mt-4 max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-[10px] leading-5 text-slate-300">{diagnosisCorrection.diff}</pre>}
              {diagnosis.failureType === 'CORRECTABLE' ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button disabled={approving} onClick={() => handleApproval('CORRECT', 'APPROVED')} className="rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{approving ? 'Submitting…' : 'Approve auto-correction'}</button>
                  <button disabled={approving} onClick={() => handleApproval('CORRECT', 'REJECTED')} className="rounded-lg border border-orange-200 bg-white px-4 py-2.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50">Reject · Terminate</button>
                </div>
              ) : <p className="mt-4 text-xs font-semibold text-orange-700">Manual investigation required for this failure type.</p>}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="sailwind-card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center justify-between"><div><p className="sailwind-eyebrow">Runtime telemetry</p><h2 className="mt-1 text-sm font-semibold text-slate-900">Deployment logs</h2></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-500">{logs.length} events</span></div>
            </div>
            <div className="h-[34rem] overflow-y-auto bg-slate-950 p-4">
              {logs.length === 0 ? <p className="text-[10px] text-slate-600">Waiting for telemetry…</p> : logs.map(log => (
                <div key={log.lineNumber} className="sailwind-mono flex gap-2 text-[9px] leading-5">
                  <span className="w-5 shrink-0 text-right text-slate-700">{log.lineNumber}</span>
                  <span className={`shrink-0 ${log.source.startsWith('check') ? 'text-amber-400' : log.source === 'diagnosis' ? 'text-orange-400' : log.source === 'verify' ? 'text-cyan-400' : 'text-slate-500'}`}>[{log.source}]</span>
                  <span className="break-all text-slate-300">{log.content}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </section>
        </aside>
      </div>
    </PageShell>
  )
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="sailwind-eyebrow">{eyebrow}</p><h2 className="mt-1 text-sm font-semibold tracking-tight text-slate-900">{title}</h2></div>
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-1 truncate text-xs font-semibold text-slate-800 ${mono ? 'sailwind-mono' : ''}`}>{value}</p></div>
}

function ApprovalCard({ title, eyebrow, tone, copy, approving, approveLabel, onApprove, onReject }: { title: string; eyebrow: string; tone: 'amber'; copy: string; approving: boolean; approveLabel: string; onApprove: () => void; onReject: () => void }) {
  return <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5"><p className="sailwind-eyebrow text-amber-700">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-amber-950">{title}</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-amber-800">{copy}</p><div className="mt-5 flex flex-wrap gap-2"><button disabled={approving} onClick={onApprove} className="rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{approving ? 'Submitting…' : `✓ ${approveLabel}`}</button><button disabled={approving} onClick={onReject} className="rounded-lg border border-amber-200 bg-white px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">Reject · Terminate</button></div></section>
}

const PIPELINE_STAGES = [
  { key: 'analysis', label: 'Analysis' },
  { key: 'pre-checks', label: 'Pre-checks' },
  { key: 'deploy', label: 'Deploy' },
  { key: 'verification', label: 'Verify' },
  { key: 'diagnosis', label: 'Diagnose' },
  { key: 'correction', label: 'Correct' },
  { key: 'redeploy', label: 'Redeploy' },
]

function StageTracker({ stages, status }: { stages: Record<string, StageUpdate>; status: string }) {
  const order = ['analysis', 'pre-checks', 'deploy', 'verification', 'diagnosis', 'correction', 'redeploy']
  const statusIndex: Record<string, number> = { ANALYZING: 0, CHECKING: 1, AWAITING_APPROVAL: 1, DEPLOYING: 2, VERIFYING: 3, FAILED: 4, CORRECTING: 5, LIVE: 6, TERMINAL: 6 }
  const current = statusIndex[status] ?? -1
  return <div className="sailwind-card mb-4 overflow-hidden"><div className="flex items-center overflow-x-auto px-5 py-4"><div className="flex min-w-max items-center">{PIPELINE_STAGES.map((s, i) => {
    const update = stages[s.key]
    const isFailed = update?.stageStatus === 'FAILED'
    const isDone = update?.stageStatus === 'DONE' || i < current || (status === 'LIVE' && i === 6)
    const isRunning = update?.stageStatus === 'RUNNING' || i === current
    const cls = isFailed ? 'border-rose-200 bg-rose-50 text-rose-700' : isDone ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : isRunning ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-400'
    return <div key={s.key} className="flex items-center"><span className={`rounded-md border px-2.5 py-1.5 text-[10px] font-semibold ${cls}`}>{isDone ? '✓ ' : ''}{s.label}</span>{i < order.length - 1 && <span className="px-1.5 text-slate-300">›</span>}</div>
  })}</div></div></div>
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen"><main className="sailwind-grid min-h-screen px-6 pb-8 pt-24 lg:px-8"><div className="mx-auto max-w-7xl">{children}</div></main></div>
}
