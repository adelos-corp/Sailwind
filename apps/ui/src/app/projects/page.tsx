'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { projects as projectsApi, type Project, type Deployment } from '@/lib/api'

interface ProjectWithLatest {
  project: Project
  latest: Deployment | null
  total: number
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'border-white/10 bg-white/[0.04] text-slate-300',
  ANALYZING: 'border-white/10 bg-white/[0.06] text-slate-200',
  CHECKING: 'border-blue-400/20 bg-blue-400/10 text-blue-300',
  AWAITING_APPROVAL: 'border-white/10 bg-white/[0.06] text-slate-200',
  DEPLOYING: 'border-blue-400/20 bg-blue-400/10 text-blue-300',
  VERIFYING: 'border-blue-400/20 bg-blue-400/10 text-blue-300',
  LIVE: 'border-blue-400/20 bg-blue-400/10 text-blue-300',
  FAILED: 'border-white/10 bg-white/[0.04] text-slate-300',
  CORRECTING: 'border-blue-400/20 bg-blue-400/10 text-blue-300',
  TERMINAL: 'border-white/10 bg-white/[0.04] text-slate-300',
}

export default function ProjectsPage() {
  const [items, setItems] = useState<ProjectWithLatest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    projectsApi.list()
      .then(async ({ projects }) => {
        const enriched = await Promise.all(projects.map(async (project) => {
          const { deployments } = await projectsApi.listDeployments(project.id)
          return { project, latest: deployments[0] ?? null, total: deployments.length }
        }))
        setItems(enriched)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen">
      <main className="sailwind-grid min-h-screen px-6 pb-24 pt-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="sailwind-eyebrow">Project inventory</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-white">Projects</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">Repositories and applications managed by the Sailwind deployment control plane.</p>
            </div>
            <Link href="/" className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-slate-950 shadow-sm hover:bg-slate-200">+ New deployment</Link>
          </div>

          {loading && (
            <div className="sailwind-card p-10 text-center"><div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-blue-400" /><p className="text-xs text-slate-500">Loading project inventory…</p></div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><span className="font-semibold">Control plane error:</span> {error}</div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="sailwind-card p-14 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-sm font-bold text-white">V</div>
              <p className="text-sm font-semibold text-slate-200">No projects registered</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">Connect a repository to create the first managed application.</p>
              <Link href="/" className="mt-5 inline-flex rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-slate-200">Deploy a repository</Link>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="sailwind-card overflow-hidden">
              <div className="grid grid-cols-[1.4fr_.5fr_.55fr] gap-4 border-b border-white/10 bg-white/[0.03] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span>Project</span><span>Deployments</span><span>Latest state</span>
              </div>
              <div className="divide-y divide-white/10">
                {items.map(({ project, latest, total }) => (
                  <div key={project.id} className="grid grid-cols-1 gap-4 px-5 py-5 transition-colors hover:bg-white/[0.03] sm:grid-cols-[1.4fr_.5fr_.55fr] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[11px] font-bold text-slate-300">P</div>
                        <p className="truncate text-sm font-semibold text-white">{project.name}</p>
                      </div>
                      <p className="sailwind-mono mt-2 truncate text-[10px] text-slate-500">{project.gitUrl ?? project.localPath ?? project.id}</p>
                    </div>
                    <p className="text-xs text-slate-500">{total} deployment{total !== 1 ? 's' : ''}</p>
                    <div>
                      {latest ? (
                        <Link href={`/deployments/${latest.id}`} className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${STATUS_COLOR[latest.status] ?? STATUS_COLOR.PENDING}`}>
                          {latest.status.replace('_', ' ')}
                        </Link>
                      ) : <span className="text-xs text-slate-500">No deployments</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
