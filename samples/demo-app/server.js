// demo-app — intentional failure scenario for the Sailwind pipeline demo.
//
// FAILURE: The app crashes on startup if APP_SECRET is missing.
// This triggers:
//   deployment → failure → Bob diagnosis → proposed correction (add env var)
//   → approval → correction applied → redeployment → successful verification

const express = require('express')

// ── INTENTIONAL FAILURE TRIGGER ───────────────────────────────────────────────
// The app refuses to start without APP_SECRET.
// In the demo Dockerfile this env var is NOT set, so the first deploy fails.
const APP_SECRET = process.env.APP_SECRET
if (!APP_SECRET) {
  console.error('[fatal] APP_SECRET environment variable is required but not set.')
  console.error('[fatal] Set APP_SECRET=<any-value> to start the server.')
  process.exit(1)
}
// ─────────────────────────────────────────────────────────────────────────────

const app = express()
const PORT = parseInt(process.env.PORT ?? '8080', 10)

app.use(express.json())

// Health endpoint — probed by Sailwind verifier
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'sailwind-demo-app',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
})

// Home
app.get('/', (_req, res) => {
  res.json({
    message: 'Hello from the Sailwind demo app!',
    routes: ['GET /', 'GET /health', 'GET /items', 'POST /items'],
  })
})

// Simple in-memory resource
const items = [
  { id: 1, name: 'Widget A' },
  { id: 2, name: 'Widget B' },
]

app.get('/items', (_req, res) => {
  res.json({ items })
})

app.post('/items', (req, res) => {
  const { name } = req.body ?? {}
  if (!name) {
    return res.status(400).json({ error: 'name is required' })
  }
  const item = { id: items.length + 1, name }
  items.push(item)
  res.status(201).json({ item })
})

app.listen(PORT, () => {
  console.log(`sailwind-demo-app listening on http://0.0.0.0:${PORT}`)
})
