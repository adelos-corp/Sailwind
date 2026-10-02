import Link from 'next/link'

const workflow = [
  ['01', 'Source', 'Repository snapshot'],
  ['02', 'Analyze', 'Dependencies · runtime · config'],
  ['03', 'Approve', 'Human decision gate'],
  ['04', 'Deploy', 'Controlled execution'],
  ['05', 'Verify', 'Health · logs · live state'],
]

const recovery = [
  ['Failure', 'Detect the signal'],
  ['Diagnosis', 'Understand what broke'],
  ['Correction', 'Propose a bounded fix'],
  ['Approval', 'Keep a human in control'],
  ['Recovery', 'Redeploy and verify'],
]

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#030507] text-white">
      <main>
        <section className="relative flex min-h-[calc(100vh-72px)] items-center justify-center px-6 pb-24 pt-24 sm:pt-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(88,166,255,0.14),transparent_36%),radial-gradient(circle_at_50%_75%,rgba(255,255,255,0.035),transparent_34%)]" />
          <div className="absolute left-1/2 top-[52%] h-px w-[72vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="relative z-10 mx-auto max-w-6xl text-center">
            <p className="mb-8 text-[10px] font-semibold uppercase tracking-[0.34em] text-slate-500">
              FAST · APPROVED · AUTO-CORRECTIBLE
            </p>
            <h1 className="text-[clamp(5rem,18vw,13rem)] font-semibold leading-[0.78] tracking-[-0.085em] text-white">
              Sailwind
            </h1>
            <p className="mx-auto mt-10 max-w-2xl text-[clamp(1.35rem,3vw,2.35rem)] font-medium leading-[1.12] tracking-[-0.035em] text-slate-200">
              Deployment, without the uncertainty.
            </p>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
              Analyze. Approve. Deploy. Recover. Verify.
              <br className="hidden sm:block" /> One controlled loop from source code to a live application.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/deploy" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-slate-200">
                Deploy an application
              </Link>
              <Link href="/about" className="rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]">
                Explore Sailwind
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-32 sm:py-44">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">The deployment loop</p>
            <h2 className="mt-5 max-w-5xl text-[clamp(3rem,8vw,7rem)] font-semibold leading-[0.9] tracking-[-0.065em] text-white">
              One deployment.
              <br />
              Every decision.
            </h2>

            <div className="mt-24 grid border-y border-white/10 lg:grid-cols-5">
              {workflow.map(([number, title, detail], index) => (
                <div
                  key={title}
                  className={[
                    'group min-h-56 p-6 transition hover:bg-white/[0.035] sm:p-8',
                    index > 0 ? 'border-t border-white/10 lg:border-l lg:border-t-0' : '',
                  ].join(' ')}
                >
                  <span className="font-mono text-[10px] text-slate-600">{number}</span>
                  <h3 className="mt-16 text-2xl font-medium tracking-[-0.035em] text-slate-100">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative border-t border-white/10 px-6 py-32 sm:py-44">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_50%,rgba(88,166,255,0.09),transparent_35%)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1fr_0.85fr] lg:gap-24">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">01 / Human control</p>
              <h2 className="mt-6 max-w-3xl text-[clamp(3rem,7vw,6.5rem)] font-semibold leading-[0.9] tracking-[-0.065em]">
                Nothing ships without your approval.
              </h2>
              <p className="mt-8 max-w-xl text-base leading-7 text-slate-500">
                Sailwind turns the proposed deployment into a decision, not a hidden side effect. Review what is about to happen before consequential execution begins.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">Sailwind / DEPLOYMENT PLAN</p>
                  <p className="mt-2 text-lg font-medium text-white">Production candidate</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] text-slate-500">Awaiting approval</span>
              </div>
              <div className="space-y-5 py-6 font-mono text-[11px]">
                {[
                  ['SOURCE', 'repository snapshot'],
                  ['RUNTIME', 'Docker'],
                  ['PORT', '8080'],
                  ['HEALTHCHECK', '/health'],
                  ['CHANGES', '03'],
                ].map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-6">
                    <span className="text-slate-600">{key}</span>
                    <span className="text-slate-300">{value}</span>
                  </div>
                ))}
              </div>
              <Link href="/deploy" className="block rounded-xl bg-white py-3 text-center text-xs font-semibold text-black transition hover:bg-slate-200">
                Review deployment
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-32 sm:py-44">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">02 / Recovery</p>
            <div className="mt-6 grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-end">
              <h2 className="text-[clamp(3rem,7vw,6.5rem)] font-semibold leading-[0.9] tracking-[-0.065em]">
                Failure isn&apos;t the end.
              </h2>
              <p className="max-w-xl text-base leading-7 text-slate-500">
                When a deployment fails, Sailwind closes the loop. It reads the failure signal, diagnoses bounded corrective actions, keeps approval in the flow, and returns to verification.
              </p>
            </div>

            <div className="mt-24 rounded-[2rem] border border-white/10 bg-[#070a0f] p-6 sm:p-10">
              <div className="grid divide-y divide-white/10 md:grid-cols-5 md:divide-x md:divide-y-0">
                {recovery.map(([title, detail], index) => (
                  <div key={title} className="relative px-2 py-7 md:px-6 md:py-2">
                    <span className="font-mono text-[10px] text-slate-700">0{index + 1}</span>
                    <h3 className="mt-4 text-lg font-medium text-slate-200">{title}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-32 sm:py-44">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">03 / Verification</p>
            <h2 className="mt-6 max-w-6xl text-[clamp(3.5rem,9vw,8rem)] font-semibold leading-[0.86] tracking-[-0.075em]">
              Verified means
              <br />
              <span className="text-slate-500">verified.</span>
            </h2>
            <div className="mt-16 flex flex-col justify-between gap-8 border-t border-white/10 pt-8 sm:flex-row sm:items-end">
              <p className="max-w-xl text-base leading-7 text-slate-500">
                A deployment is not finished because a command returned successfully. Sailwind checks the running application and closes the loop on the state that actually matters.
              </p>
              <Link href="/projects" className="shrink-0 text-sm font-medium text-slate-300 transition hover:text-white">
                View deployment activity →
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 px-6 py-36 text-center sm:py-52">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600">Sailwind</p>
          <h2 className="mx-auto mt-7 max-w-5xl text-[clamp(4rem,10vw,9rem)] font-semibold leading-[0.82] tracking-[-0.08em]">
            Ship with
            <br />
            certainty.
          </h2>
          <p className="mx-auto mt-8 max-w-md text-sm leading-6 text-slate-500">
            A deployment control plane built around speed, approval, recovery, and verification.
          </p>
          <div className="mt-9">
            <Link href="/deploy" className="inline-flex rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black transition hover:bg-slate-200">
              Start a deployment
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
