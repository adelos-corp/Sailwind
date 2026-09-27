import type { FastifyInstance } from 'fastify'
import { createProject, getProjectById, listProjects } from '../store/projects.store'
import {
  createDeployment,
  listDeploymentsByProject,
} from '../store/deployments.store'
import { startPipeline } from '../services/pipeline'

export async function projectRoutes(app: FastifyInstance) {
  app.get('/projects', async () => {
    return { projects: await listProjects() }
  })

  app.post<{
    Body: { name?: string; gitUrl?: string; localPath?: string }
  }>('/projects', async (request, reply) => {
    const { name, gitUrl, localPath } = request.body ?? {}

    if (!gitUrl && !localPath) {
      return reply.status(400).send({ error: 'Either gitUrl or localPath is required' })
    }

    const derivedName =
      name ??
      (gitUrl
        ? gitUrl.split('/').pop()?.replace('.git', '') ?? 'project'
        : (localPath?.split('/').pop() ?? 'project'))

    const project = await createProject({ name: derivedName, gitUrl, localPath })
    return reply.status(201).send({ project })
  })

  app.get<{ Params: { id: string } }>('/projects/:id', async (request, reply) => {
    const project = await getProjectById(request.params.id)
    if (!project) return reply.status(404).send({ error: 'Project not found' })
    return { project }
  })

  app.get<{ Params: { id: string } }>(
    '/projects/:id/deployments',
    async (request, reply) => {
      const project = await getProjectById(request.params.id)
      if (!project) return reply.status(404).send({ error: 'Project not found' })
      return { deployments: await listDeploymentsByProject(request.params.id) }
    }
  )

  app.post<{ Params: { id: string } }>(
    '/projects/:id/deployments',
    async (request, reply) => {
      const project = await getProjectById(request.params.id)
      if (!project) return reply.status(404).send({ error: 'Project not found' })

      const existing = await listDeploymentsByProject(request.params.id)
      const deployment = await createDeployment({
        projectId: request.params.id,
        attemptNumber: existing.length + 1,
      })

      setImmediate(() => startPipeline(deployment.id).catch(console.error))
      return reply.status(201).send({ deployment })
    }
  )
}
