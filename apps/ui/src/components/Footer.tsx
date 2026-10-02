import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/20">
      <div className="mx-auto flex max-w-6xl flex-col gap-7 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div>
          <p className="text-xs font-semibold text-slate-300">Sailwind</p>
          <p className="mt-1 text-[11px] text-slate-600">Fast · Approved · Auto-Correctible · Verified</p>
          <p className="mt-4 text-xs text-slate-500">Made by Akhil Anand using IBM Bob 2.0</p>
          <p className="mt-1 text-[11px] text-slate-600">Under ADELOS Corp.</p>
        </div>

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-500">
            <Link href="/about" className="hover:text-slate-200">About</Link>
            <Link href="/deploy" className="hover:text-slate-200">Deploy</Link>
            <Link href="/projects" className="hover:text-slate-200">Projects</Link>
            <Link href="/preferences" className="hover:text-slate-200">Preferences</Link>
            <Link href="/contact" className="hover:text-slate-200">Contact</Link>
          </div>

          <a
            href="https://adeloscorp.com"
            target="_blank"
            rel="noreferrer"
            aria-label="ADELOS Corp."
            title="ADELOS Corp."
            className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:bg-white/[0.07]"
          >
            <img src="/adelo-logo.svg" alt="ADELOS Corp." className="h-8 w-10 object-contain transition-opacity group-hover:opacity-80" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">ADELOS Corp.</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
