import Fastify from 'fastify'
import cors from '@fastify/cors'
import { projectRoutes } from './routes/projects'
import { deploymentRoutes } from './routes/deployments'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const HOST = process.env.HOST ?? '0.0.0.0'

async function main() {
  const app = Fastify({ logger: { level: 'info' } })

  // CORS — allow UI dev server
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3100',
    credentials: true,
  })

  // Health check
  const health = async () => ({
    status: 'ok',
    service: 'visa-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  })

  app.get('/health', health)
  app.get('/api/health', health)

  // Routes — persistent control-plane state lives in Supabase
  await app.register(projectRoutes)
  await app.register(deploymentRoutes)

  // Production service routing may preserve the /api prefix.
  // Register the same API surface under /api so production does not
  // depend on Vercel path rewriting behavior.
  await app.register(projectRoutes, { prefix: '/api' })
  await app.register(deploymentRoutes, { prefix: '/api' })

  // Start server
  await app.listen({ port: PORT, host: HOST })
  console.log(`✓ visa-api listening on http://localhost:${PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
