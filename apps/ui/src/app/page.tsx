import Link from 'next/link'

export default function Home() {
  return (
    <main className="sailwind-grid min-h-screen">
      <section className="relative flex min-h-[calc(100vh-74px)] items-center justify-center overflow-hidden px-6 pb-24 pt-28 sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(88,166,255,0.12),transparent_36%)]" />
        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <p className="sailwind-eyebrow">Part of Codelos</p>
          <h1 className="mt-6 text-[clamp(5rem,18vw,13rem)] font-semibold leading-[0.78] tracking-[-0.085em] text-white">
            Sailwind
          </h1>
          <p className="mx-auto mt-10 max-w-2xl text-[clamp(1.35rem,3vw,2.25rem)] font-medium leading-[1.08] tracking-[-0.04em] text-slate-200">
            Deploy without babysitting.
          </p>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-slate-500 sm:text-base">
            Analyze, approve, recover, and verify your applications in one controlled loop.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/deploy" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-slate-200">
              Deploy an application
            </Link>
            <Link href="/how-it-works" className="rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]">
              How Sailwind works
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-6 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-3">
          {[
            ['Analyze', 'Understand the application before execution.'],
            ['Recover', 'Diagnose bounded failures and propose a correction.'],
            ['Verify', 'Check the running application, not just the command.'],
          ].map(([title, copy]) => (
            <div key={title}>
              <h2 className="text-lg font-medium tracking-[-0.02em] text-white">{title}</h2>
              <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
