import Fastify from 'fastify'
import cors from '@fastify/cors'
import { runMigrations } from './store/migrations'
import { projectRoutes } from './routes/projects'
import { deploymentRoutes } from './routes/deployments'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const HOST = process.env.HOST ?? '0.0.0.0'

async function main() {
  // Run DB migrations on startup
  runMigrations()

  const app = Fastify({ logger: { level: 'info' } })

  // CORS — allow UI dev server
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3100',
    credentials: true,
  })

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: 'sailwind-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }))

  // Routes
  await app.register(projectRoutes)
  await app.register(deploymentRoutes)

  // Start server
  await app.listen({ port: PORT, host: HOST })
  console.log(`✓ sailwind-api listening on http://localhost:${PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
