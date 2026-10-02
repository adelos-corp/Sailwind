import Link from 'next/link'

const stages = [
  ['01', 'Analyze', 'Sailwind inspects the repository, runtime, dependencies, configuration, ports, and health path before execution.'],
  ['02', 'Approve', 'A deployment plan is presented for human review. Consequential execution stays behind an explicit approval gate.'],
  ['03', 'Deploy', 'Sailwind builds and runs the application in a controlled environment, while exposing the activity as it happens.'],
  ['04', 'Detect', 'If the running application fails, Sailwind captures the failure signal instead of treating the first error as the end of the workflow.'],
  ['05', 'Diagnose', 'Granite analyzes the failure and produces a bounded explanation and proposed correction.'],
  ['06', 'Recover', 'The proposed correction is reviewed, applied, and used to rebuild the deployment.'],
  ['07', 'Verify', 'Sailwind checks the running application and only then considers the deployment live.'],
]

export default function HowItWorksPage() {
  return (
    <main className="sailwind-grid min-h-screen px-6 pb-24 pt-32 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-3xl">
          <p className="sailwind-eyebrow">How Sailwind works</p>
          <h1 className="mt-5 text-[clamp(3.5rem,8vw,7rem)] font-semibold leading-[0.88] tracking-[-0.07em] text-white">
            A deployment loop that closes itself.
          </h1>
          <p className="mt-8 max-w-2xl text-base leading-7 text-slate-400">
            Sailwind connects code to deployment without hiding the decisions, failures, or recovery steps in between.
          </p>
        </header>

        <section className="mt-20 border-y border-white/10">
          {stages.map(([number, title, copy]) => (
            <article key={title} className="grid gap-5 border-b border-white/10 py-8 last:border-b-0 sm:grid-cols-[80px_180px_1fr] sm:items-start">
              <span className="sailwind-mono text-[10px] text-slate-600">{number}</span>
              <h2 className="text-xl font-medium tracking-[-0.03em] text-white">{title}</h2>
              <p className="max-w-xl text-sm leading-6 text-slate-500">{copy}</p>
            </article>
          ))}
        </section>

        <section className="mt-20 grid gap-10 border-t border-white/10 pt-10 sm:grid-cols-3">
          <div><h2 className="text-sm font-semibold text-white">Why</h2><p className="mt-2 text-sm leading-6 text-slate-500">Deployment failures are part of shipping. Sailwind keeps diagnosis and recovery inside the same controlled workflow.</p></div>
          <div><h2 className="text-sm font-semibold text-white">Uses</h2><p className="mt-2 text-sm leading-6 text-slate-500">Use it to inspect repositories, review deployment plans, run controlled deployments, recover from bounded failures, and verify live applications.</p></div>
          <div><h2 className="text-sm font-semibold text-white">Who</h2><p className="mt-2 text-sm leading-6 text-slate-500">Developers and teams who want fast deployment without giving up visibility or human approval.</p></div>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/deploy" className="rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-slate-200">Start a deployment</Link>
          <Link href="/about" className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08]">About Sailwind</Link>
        </div>
      </div>
    </main>
  )
}
