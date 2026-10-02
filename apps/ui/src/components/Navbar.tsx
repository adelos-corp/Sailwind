'use client'

import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import GlassSurface from '@/components/react-bits/GlassSurface'

const links = [
  { href: '/', label: 'Overview' },
  { href: '/projects', label: 'Projects' },
  { href: '/deploy', label: 'Deploy' },
  { href: '/about', label: 'About' },
]

export function Navbar() {
  const pathname = usePathname()
  const navRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

  useEffect(() => {
    if (pathname !== '/' || sessionStorage.getItem('sailwind-scroll-home') !== 'true') return
    sessionStorage.removeItem('sailwind-scroll-home')
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }, [pathname])

  useLayoutEffect(() => {
    const update = () => {
      const activeHref = links.find(link => link.href === '/' ? pathname === '/' : pathname.startsWith(link.href))?.href ?? '/'
      const nav = navRef.current
      const item = itemRefs.current[activeHref]
      if (!nav || !item) return
      const navRect = nav.getBoundingClientRect()
      const itemRect = item.getBoundingClientRect()
      setIndicator({
        left: itemRect.left - navRect.left,
        width: itemRect.width,
        ready: true,
      })
    }

    update()
    const observer = new ResizeObserver(update)
    if (navRef.current) observer.observe(navRef.current)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [pathname])

  function handleHomeClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (pathname === '/') {
      event.preventDefault()
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    sessionStorage.setItem('sailwind-scroll-home', 'true')
  }

  return (
    <div className="fixed inset-x-0 top-4 z-[100] px-4 sm:px-6 lg:px-8 pointer-events-none">
      <div className="mx-auto max-w-6xl pointer-events-auto">
        <GlassSurface
          width="100%"
          height={58}
          borderRadius={999}
          backgroundOpacity={0.34}
          saturation={0.9}
          distortionScale={-60}
          className="sailwind-navbar-glass border border-[#355b88]/30 shadow-2xl shadow-black/30"
        >
          <nav className="flex h-full w-full items-center justify-between px-3 sm:px-4">
            <a
              href="https://www.adeloscorp.com/technology/codelos"
              target="_blank"
              rel="noreferrer"
              aria-label="Codelos by ADELOS Corp."
              className="text-sm font-semibold tracking-[-0.02em] text-slate-100 transition-opacity hover:opacity-70"
            >
              Codelos
            </a>

            <div ref={navRef} className="relative flex items-center gap-1 text-xs">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 rounded-full border border-white/10 bg-white/[0.10] shadow-[0_4px_18px_rgba(0,0,0,0.14)] transition-[transform,width] duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
                style={{
                  width: indicator.width,
                  transform: `translateX(${indicator.left}px)`,
                  opacity: indicator.ready ? 1 : 0,
                }}
              />

              {links.map(link => {
                const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    ref={node => { itemRefs.current[link.href] = node }}
                    onClick={link.href === '/' ? handleHomeClick : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`relative z-10 rounded-full px-3.5 py-1.5 font-medium transition-colors duration-300 ${
                      active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </nav>
        </GlassSurface>
      </div>
    </div>
  )
}
