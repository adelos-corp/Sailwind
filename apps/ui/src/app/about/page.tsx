import Link from 'next/link'

export default function AboutPage() {
  return (
    <main className="sailwind-grid min-h-screen px-6 pb-24 pt-32 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="sailwind-eyebrow">About Sailwind</p>
        <h1 className="mt-5 max-w-3xl text-[clamp(3.5rem,8vw,7rem)] font-semibold leading-[0.88] tracking-[-0.07em] text-white">
          Deployment is part of the coding environment.
        </h1>
        <p className="mt-8 max-w-2xl text-base leading-7 text-slate-400">
          Sailwind is the deployment and recovery layer of Codelos, ADELOS Corp.&apos;s coding environment. It takes an application from source code toward a live, verified state without treating deployment as a separate ceremony.
        </p>

        <div className="mt-20 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2">
          {[
            ['Codelos', 'The coding environment that brings development tools and workflows together.'],
            ['Sailwind', 'The deployment control plane inside that environment, built to analyze, approve, recover, and verify.'],
            ['ADELOS Corp.', 'The company behind Codelos and the wider technology platform.'],
            ['The connection', 'Code is written in Codelos. Sailwind carries that work through a controlled path to a verified deployment.'],
          ].map(([title, copy]) => (
            <section key={title} className="bg-[#070a0f] p-7 sm:p-9">
              <h2 className="text-xl font-medium tracking-[-0.03em] text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">{copy}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/how-it-works" className="rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-slate-200">How Sailwind works</Link>
          <a href="https://www.adeloscorp.com/technology/codelos" target="_blank" rel="noreferrer" className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08]">Explore Codelos</a>
        </div>
      </div>
    </main>
  )
}
