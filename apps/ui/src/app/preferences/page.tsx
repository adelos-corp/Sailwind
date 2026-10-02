'use client'

import { useEffect, useState } from 'react'

type Preferences = {
  theme: 'dark' | 'light' | 'system'
  accent: 'blue' | 'neutral'
  compact: boolean
  reducedMotion: boolean
  glassEffects: boolean
  notifications: boolean
  deploymentConfirmation: boolean
  autoCorrection: boolean
  autoCorrectionLimit: number
  defaultPort: number
  environment: 'local-docker' | 'remote'
  logRetention: 'session' | '7d' | '30d' | 'forever'
  localPreferences: boolean
  telemetry: boolean
}

const defaults: Preferences = {
  theme: 'dark',
  accent: 'blue',
  compact: false,
  reducedMotion: false,
  glassEffects: true,
  notifications: true,
  deploymentConfirmation: true,
  autoCorrection: true,
  autoCorrectionLimit: 1,
  defaultPort: 18080,
  environment: 'local-docker',
  logRetention: '30d',
  localPreferences: true,
  telemetry: false,
}

function loadPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem('sailwind-preferences') ?? '{}')
    return { ...defaults, ...stored, theme: (stored.theme ?? localStorage.getItem('sailwind-theme') ?? 'dark') as Preferences['theme'] }
  } catch {
    return defaults
  }
}

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<Preferences>(defaults)
  const [saved, setSaved] = useState(false)

  useEffect(() => setPrefs(loadPreferences()), [])

  function toggle(key: keyof Preferences) {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] } as Preferences))
    setSaved(false)
  }

  function save() {
    localStorage.setItem('sailwind-preferences', JSON.stringify(prefs))
    const theme = prefs.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : prefs.theme
    document.documentElement.dataset.theme = theme
    localStorage.setItem('sailwind-theme', theme)
    document.documentElement.dataset.reducedMotion = prefs.reducedMotion ? 'true' : 'false'
    document.documentElement.dataset.compact = prefs.compact ? 'true' : 'false'
    document.documentElement.dataset.glassEffects = prefs.glassEffects ? 'true' : 'false'
    document.documentElement.dataset.accent = prefs.accent
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  function clearLocalData() {
    localStorage.removeItem('sailwind-preferences')
    localStorage.removeItem('sailwind-theme')
    setPrefs(defaults)
    document.documentElement.dataset.theme = 'dark'
    document.documentElement.dataset.reducedMotion = 'false'
    document.documentElement.dataset.compact = 'false'
    document.documentElement.dataset.glassEffects = 'true'
    document.documentElement.dataset.accent = 'blue'
  }

  return (
    <main className="sailwind-grid min-h-screen px-4 pb-24 pt-32 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="max-w-3xl">
          <p className="sailwind-eyebrow">Workspace / Preferences</p>
          <h1 className="mt-4 text-[clamp(3.5rem,8vw,7rem)] font-semibold leading-[0.86] tracking-[-0.07em] text-white">
            Make Sailwind<br /><span className="text-slate-500">yours.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-slate-500">
            Control how the workspace looks, behaves, and communicates with you. These settings live in this browser.
          </p>
        </header>

        <div className="mt-20 space-y-4">
          <section className="sailwind-settings-card">
            <SettingsHeading eyebrow="01 / Appearance" title="Set the tone." copy="The visual system follows the same restrained, editorial language as the rest of Sailwind." />
            <div className="sailwind-setting-row">
              <div><h2>Theme</h2><p>Choose the visual theme for this workspace.</p></div>
              <Segmented value={prefs.theme} options={['dark', 'light', 'system']} onChange={value => setPrefs(p => ({ ...p, theme: value as Preferences['theme']}))} />
            </div>
            <div className="sailwind-setting-row">
              <div><h2>Accent</h2><p>Choose the visual accent used for highlights and active states.</p></div>
              <Segmented value={prefs.accent} options={['blue', 'neutral']} onChange={value => setPrefs(p => ({ ...p, accent: value as Preferences['accent']}))} />
            </div>
          </section>

          <section className="sailwind-settings-card">
            <SettingsHeading eyebrow="02 / Interface" title="Less noise. More signal." copy="Keep the control plane focused on the decisions that matter." />
            <SettingToggle title="Compact interface" copy="Reduce spacing across dashboard surfaces, lists, and deployment views." value={prefs.compact} onChange={() => toggle('compact')} />
            <SettingToggle title="Reduce motion" copy="Minimize non-essential transitions and animated effects." value={prefs.reducedMotion} onChange={() => toggle('reducedMotion')} />
            <SettingToggle title="Glass effects" copy="Keep the Liquid Glass treatment used throughout the interface." value={prefs.glassEffects} onChange={() => toggle('glassEffects')} last />
          </section>

          <section className="sailwind-settings-card">
            <SettingsHeading eyebrow="03 / Deployment" title="Keep the human in the loop." copy="Sailwind can move quickly without turning consequential actions into invisible side effects." />
            <SettingToggle title="Deployment notifications" copy="Show deployment status feedback and completion updates in the interface." value={prefs.notifications} onChange={() => toggle('notifications')} />
            <SettingToggle title="Deployment confirmation" copy="Require explicit confirmation before a deployment begins." value={prefs.deploymentConfirmation} onChange={() => toggle('deploymentConfirmation')} />
            <SettingToggle title="Auto-correction" copy="Allow Sailwind to propose and apply approved corrections after a recoverable failure." value={prefs.autoCorrection} onChange={() => toggle('autoCorrection')} />
            <div className="sailwind-setting-row">
              <div><h2>Auto-correction limit</h2><p>Maximum correction attempts for one deployment.</p></div>
              <select value={prefs.autoCorrectionLimit} onChange={e => setPrefs(p => ({ ...p, autoCorrectionLimit: Number(e.target.value)}))} className="sailwind-select">
                <option value={1}>1 attempt</option><option value={2}>2 attempts</option><option value={3}>3 attempts</option>
              </select>
            </div>
          </section>

          <section className="sailwind-settings-card">
            <SettingsHeading eyebrow="04 / Workspace" title="Choose the defaults." copy="These values shape new local deployment sessions." />
            <div className="sailwind-setting-row">
              <div><h2>Default deployment port</h2><p>Host port used for local deployment environments.</p></div>
              <input type="number" value={prefs.defaultPort} onChange={e => setPrefs(p => ({ ...p, defaultPort: Number(e.target.value)}))} className="sailwind-input w-28" />
            </div>
            <div className="sailwind-setting-row">
              <div><h2>Deployment environment</h2><p>Environment used when creating a new deployment.</p></div>
              <Segmented value={prefs.environment} options={['local-docker', 'remote']} labels={{'local-docker':'Local Docker',remote:'Remote'}} onChange={value => setPrefs(p => ({ ...p, environment: value as Preferences['environment']}))} />
            </div>
            <div className="sailwind-setting-row">
              <div><h2>Keep deployment logs</h2><p>Choose how long deployment logs remain available locally.</p></div>
              <Segmented value={prefs.logRetention} options={['session','7d','30d','forever']} labels={{session:'Session','7d':'7 days','30d':'30 days',forever:'Forever'}} onChange={value => setPrefs(p => ({ ...p, logRetention: value as Preferences['logRetention']}))} />
            </div>
          </section>

          <section className="sailwind-settings-card">
            <SettingsHeading eyebrow="05 / Privacy & data" title="Keep control local." copy="Sailwind separates browser preferences from project and deployment data." />
            <SettingToggle title="Local preferences" copy="Store interface preferences in this browser." value={prefs.localPreferences} onChange={() => toggle('localPreferences')} />
            <SettingToggle title="Anonymous telemetry" copy="Share anonymous usage information to help improve Sailwind." value={prefs.telemetry} onChange={() => toggle('telemetry')} last />
            <div className="sailwind-danger-row">
              <div><h2>Clear local data</h2><p>Remove saved Sailwind preferences and workspace state from this browser.</p></div>
              <button type="button" onClick={clearLocalData} className="sailwind-danger-button">Clear local data</button>
            </div>
          </section>
        </div>

        <section className="mt-4 border-t border-white/10 pt-10">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div><p className="sailwind-eyebrow">Sailwind / 1.0.0</p><p className="mt-2 text-xs text-slate-600">Deployment engine: Docker · AI agent: IBM Bob 2.0 · Under ADELOS Corp.</p></div>
            <button onClick={save} className="rounded-full bg-white px-6 py-3 text-xs font-semibold text-slate-950 transition hover:bg-slate-200">{saved ? 'Saved' : 'Save preferences'}</button>
          </div>
        </section>
      </div>
    </main>
  )
}

function SettingsHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="border-b border-white/10 px-6 pb-7 pt-7 sm:px-8"><p className="sailwind-eyebrow">{eyebrow}</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{title}</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">{copy}</p></div>
}

function SettingToggle({ title, copy, value, onChange, last = false }: { title: string; copy: string; value: boolean; onChange: () => void; last?: boolean }) {
  return <div className={`sailwind-setting-row ${last ? '' : 'border-b border-white/10'}`}><div><h2>{title}</h2><p>{copy}</p></div><button type="button" aria-pressed={value} onClick={onChange} className={`sailwind-toggle ${value ? 'is-on' : ''}`}><span /></button></div>
}

function Segmented({ value, options, labels = {}, onChange }: { value: string; options: string[]; labels?: Record<string,string>; onChange: (value: string) => void }) {
  return <div className="sailwind-segmented">{options.map(option => <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)} className={value === option ? 'is-active' : ''}>{labels[option] ?? option}</button>)}</div>
}
