'use client'

import { useState } from 'react'

export default function ContactPage() {
  const [copied, setCopied] = useState(false)
  const issueUrl = 'https://github.com/adelos-corp/Sailwind-IBM/issues/new'

  async function copyLink() {
    await navigator.clipboard?.writeText(issueUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <main className="sailwind-grid min-h-screen px-4 pb-24 pt-32 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="max-w-2xl">
          <p className="sailwind-eyebrow">Contact</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Tell us what broke. Or what should exist.</h1>
          <p className="mt-4 text-sm leading-6 text-slate-400">For this prototype, feedback and issue reports live alongside the project so the whole team can see them.</p>
        </div>

        <section className="mt-10 sailwind-card p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Open a GitHub issue</p>
              <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">Use the issue tracker for bugs, feature requests, deployment failures, or demo feedback.</p>
            </div>
            <a href={issueUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-slate-200">Open issues →</a>
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">Issue endpoint</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <code className="break-all text-xs text-slate-400">{issueUrl}</code>
              <button onClick={copyLink} className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.06]">{copied ? 'Copied' : 'Copy link'}</button>
            </div>
          </div>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
            <p className="text-xs font-semibold text-white">Bug report</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Include the deployment ID, status, and relevant logs. Screenshots are useful too.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
            <p className="text-xs font-semibold text-white">Feature request</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Describe the workflow you want to improve and what success would look like.</p>
          </div>
        </section>
      </div>
    </main>
  )
}
