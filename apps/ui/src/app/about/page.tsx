import Link from 'next/link'

const principles = [
  ['FAST', 'Parallel analysis and a focused deployment path reduce unnecessary workflow overhead.'],
  ['APPROVED', 'Sailwind keeps consequential actions behind explicit human approval gates.'],
  ['AUTO-CORRECTIBLE', 'Recoverable failures can be diagnosed, proposed as a patch, approved, and retried.'],
  ['VERIFIED', 'A deployment is not considered complete until the running application passes verification.'],
]

export default function AboutPage() {
  return (
    <main className="sailwind-grid min-h-screen px-4 pb-24 pt-32 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-3xl">
          <p className="sailwind-eyebrow">About Sailwind</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">Deployment, with a recovery loop.</h1>
          <p className="mt-5 text-sm leading-7 text-slate-400 sm:text-base">
            Sailwind is a controlled web deployment platform built around one simple idea: shipping an application should include understanding what happened when shipping goes wrong.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {principles.map(([title, copy], index) => (
            <section key={title} className="sailwind-card p-6">
              <span className="text-[10px] font-semibold tracking-[0.2em] text-slate-600">0{index + 1}</span>
              <h2 className="mt-5 text-lg font-semibold text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{copy}</p>
            </section>
          ))}
        </div>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
          <p className="sailwind-eyebrow">How it works</p>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
            {['Source', 'Analyze', 'Approve', 'Deploy', 'Monitor', 'Diagnose', 'Correct', 'Redeploy', 'Verify'].map((item, i) => (
              <span key={item} className="flex items-center gap-2">
                <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-slate-300">{item}</span>
                {i < 8 && <span className="text-slate-700">→</span>}
              </span>
            ))}
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/deploy" className="rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-slate-200">Deploy an application</Link>
          <Link href="/contact" className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.08]">Contact / feedback</Link>
        </div>
      </div>
    </main>
  )
}
