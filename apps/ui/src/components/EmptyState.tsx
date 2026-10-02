'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { projects as projectsApi, type Deployment, type Project } from '@/lib/api'

interface RecentItem { deployment: Deployment; project: Project }

const statusClass: Record<string, string> = {
  LIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  TERMINAL: 'border-rose-200 bg-rose-50 text-rose-700',
  FAILED: 'border-rose-200 bg-rose-50 text-rose-700',
  AWAITING_APPROVAL: 'border-amber-200 bg-amber-50 text-amber-700',
}

export function EmptyState() {
  const [items, setItems] = useState<RecentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    projectsApi.list()
      .then(async ({ projects }) => {
        const results: RecentItem[] = []
        await Promise.all(projects.map(async (project) => {
          const { deployments } = await projectsApi.listDeployments(project.id)
          deployments.slice(0, 3).forEach((deployment) => results.push({ deployment, project }))
        }))
        results.sort((a, b) => new Date(b.deployment.createdAt).getTime() - new Date(a.deployment.createdAt).getTime())
        setItems(results.slice(0, 5))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="sailwind-card p-6 text-xs text-slate-400">Loading deployment activity…</div>

  if (items.length === 0) {
    return (
      <div className="sailwind-card border-dashed p-10 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">V</div>
        <p className="text-sm font-semibold text-slate-700">No deployment activity</p>
        <p className="mt-1 text-xs text-slate-400">Submit a repository above to initialize a managed deployment.</p>
      </div>
    )
  }

  return (
    <div className="sailwind-card overflow-hidden">
      <div className="grid grid-cols-[1.2fr_.7fr_.45fr] gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        <span>Application</span><span>Created</span><span>State</span>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map(({ deployment, project }) => (
          <Link key={deployment.id} href={`/deployments/${deployment.id}`} className="grid grid-cols-1 gap-3 px-5 py-4 transition-colors hover:bg-slate-50 sm:grid-cols-[1.2fr_.7fr_.45fr] sm:items-center">
            <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-800">{project.name}</p><p className="sailwind-mono mt-1 truncate text-[9px] text-slate-400">{deployment.id}</p></div>
            <p className="text-[10px] text-slate-400">{new Date(deployment.createdAt).toLocaleString()}</p>
            <span className={`inline-flex w-fit rounded-full border px-2 py-1 text-[9px] font-semibold ${statusClass[deployment.status] ?? 'border-slate-200 bg-slate-50 text-slate-600'}`}>{deployment.status.replace('_', ' ')}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
