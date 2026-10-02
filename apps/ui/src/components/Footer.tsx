import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/20">
      <div className="mx-auto flex max-w-6xl flex-col gap-7 px-4 py-10 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        <div>
          <p className="text-xs font-semibold text-slate-300">Sailwind</p>
          <p className="mt-1 text-[11px] text-slate-600">Fast · Approved · Auto-Correctible · Verified</p>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-500">
          <Link href="/about" className="hover:text-slate-200">About</Link>
          <Link href="/how-it-works" className="hover:text-slate-200">How Sailwind works</Link>
          <Link href="/deploy" className="hover:text-slate-200">Deploy</Link>
          <Link href="/projects" className="hover:text-slate-200">Projects</Link>
          <Link href="/contact" className="hover:text-slate-200">Contact</Link>
        </div>
      </div>
    </footer>
  )
}
