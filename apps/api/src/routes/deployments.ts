import type { FastifyInstance } from 'fastify'
import { getDeploymentById, getLogs, updateDeploymentStatus } from '../store/deployments.store'
import { getPreCheckReport, getPlan, getDiagnosis } from '../store/pipeline.store'
import { registerSseClient, unregisterSseClient } from '../services/sse'
import {
  startPipeline,
  resumeAfterDeployApproval,
  resumeAfterCorrectionApproval,
} from '../services/pipeline'
import { insert } from '../store/supabase'
import { randomUUID } from 'crypto'

export async function deploymentRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>('/deployments/:id', async (request, reply) => {
    const d = await getDeploymentById(request.params.id)
    if (!d) return reply.status(404).send({ error: 'Deployment not found' })
    return { deployment: d }
  })

  app.get<{ Params: { id: string } }>('/deployments/:id/logs', async (request, reply) => {
    const d = await getDeploymentById(request.params.id)
    if (!d) return reply.status(404).send({ error: 'Deployment not found' })
    return { deploymentId: request.params.id, logs: await getLogs(request.params.id) }
  })

  app.get<{ Params: { id: string } }>('/deployments/:id/checks', async (request, reply) => {
    const d = await getDeploymentById(request.params.id)
    if (!d) return reply.status(404).send({ error: 'Deployment not found' })
    return { deploymentId: request.params.id, report: await getPreCheckReport(request.params.id) }
  })

  app.get<{ Params: { id: string } }>('/deployments/:id/plan', async (request, reply) => {
    const d = await getDeploymentById(request.params.id)
    if (!d) return reply.status(404).send({ error: 'Deployment not found' })
    return { deploymentId: request.params.id, plan: await getPlan(request.params.id) }
  })

  app.get<{ Params: { id: string } }>('/deployments/:id/diagnosis', async (request, reply) => {
    const d = await getDeploymentById(request.params.id)
    if (!d) return reply.status(404).send({ error: 'Deployment not found' })
    return { deploymentId: request.params.id, diagnosis: await getDiagnosis(request.params.id) }
  })

  app.get<{ Params: { id: string } }>('/deployments/:id/events', async (request, reply) => {
    const d = await getDeploymentById(request.params.id)
    if (!d) return reply.status(404).send({ error: 'Deployment not found' })

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('Access-Control-Allow-Origin', '*')

    reply.raw.write(`data: ${JSON.stringify({
      type: 'status',
      deploymentId: request.params.id,
      payload: { status: d.status },
      timestamp: new Date().toISOString(),
    })}\n\n`)

    registerSseClient(request.params.id, reply.raw)

    const ping = setInterval(() => { reply.raw.write(': ping\n\n') }, 15000)
    request.raw.on('close', () => {
      clearInterval(ping)
      unregisterSseClient(request.params.id, reply.raw)
    })

    await new Promise(() => {})
  })

  app.post<{ Params: { id: string } }>('/deployments/:id/run', async (request, reply) => {
    const d = await getDeploymentById(request.params.id)
    if (!d) return reply.status(404).send({ error: 'Deployment not found' })
    if (d.status !== 'PENDING') {
      return reply.status(409).send({ error: `Cannot run from status ${d.status}` })
    }
    setImmediate(() => startPipeline(request.params.id).catch(console.error))
    return { started: true }
  })

  app.post<{
    Params: { id: string }
    Body: { gate: 'DEPLOY' | 'CORRECT'; decision: 'APPROVED' | 'REJECTED'; notes?: string }
  }>('/deployments/:id/approve', async (request, reply) => {
    const d = await getDeploymentById(request.params.id)
    if (!d) return reply.status(404).send({ error: 'Deployment not found' })

    const { gate, decision, notes } = request.body ?? {}
    if (!gate || !decision) return reply.status(400).send({ error: 'gate and decision are required' })

    const approvalId = randomUUID()
    await insert('visa_approvals', {
      id: approvalId,
      deployment_id: request.params.id,
      gate,
      decision,
      user_notes: notes ?? null,
    })

    if (decision === 'REJECTED') {
      await updateDeploymentStatus(request.params.id, 'TERMINAL')
      return { approvalId, gate, decision }
    }

    // Keep the approval request alive while the consequential pipeline work runs.
    // Vercel Functions can terminate fire-and-forget work immediately after the
    // response, which previously left approved deployments stuck at DEPLOY.
    if (gate === 'DEPLOY') {
      await resumeAfterDeployApproval(request.params.id)
    } else if (gate === 'CORRECT') {
      await resumeAfterCorrectionApproval(request.params.id)
    }

    return { approvalId, gate, decision }
  })
}
