'use client'

import { DeployForm } from '@/components/DeployForm'
import Link from 'next/link'

export default function DeployPage() {
  return (
    <main className="sailwind-grid min-h-screen px-4 pb-24 pt-32 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 max-w-2xl">
          <p className="sailwind-eyebrow">Deployment center</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Ship without the guesswork.</h1>
          <p className="mt-4 text-sm leading-6 text-slate-400 sm:text-base">
            Connect a repository, let Sailwind inspect it, review the plan, and keep a human approval gate before anything consequential happens.
          </p>
        </div>

        <section className="sailwind-card overflow-hidden">
          <div className="border-b border-white/10 px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Create a deployment</p>
                <p className="mt-1 text-xs text-slate-500">Git repositories and local project paths are supported.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-medium text-slate-400">Approval required</span>
            </div>
          </div>
          <div className="p-6 sm:p-8"><DeployForm /></div>
        </section>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ['01', 'Analyze', 'Dependencies, configuration, and deployment requirements.'],
            ['02', 'Approve', 'Review the generated deployment plan before execution.'],
            ['03', 'Verify', 'Health-check the result and surface recovery actions.'],
          ].map(([n, title, copy]) => (
            <div key={title} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <span className="text-[10px] font-semibold text-slate-600">{n}</span>
              <h2 className="mt-3 text-sm font-semibold text-slate-200">{title}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-slate-600">
          Need to inspect existing deployments? <Link href="/projects" className="text-slate-400 hover:text-white">Open project inventory →</Link>
        </p>
      </div>
    </main>
  )
}
