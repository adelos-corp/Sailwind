'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [light, setLight] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('sailwind-theme')
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
    const isLight = stored ? stored === 'light' : prefersLight
    document.documentElement.dataset.theme = isLight ? 'light' : 'dark'
    setLight(isLight)
  }, [])

  function toggle() {
    const next = !light
    setLight(next)
    document.documentElement.dataset.theme = next ? 'light' : 'dark'
    localStorage.setItem('sailwind-theme', next ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}
      title={light ? 'Switch to dark mode' : 'Switch to light mode'}
      className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-slate-400 transition hover:bg-white/[0.08] hover:text-slate-200"
    >
      <span aria-hidden="true">{light ? '☾' : '☀'}</span>
    </button>
  )
}
