import { randomUUID } from 'crypto'
import type { Deployment, DeploymentStatus } from '../types'
import { count, insert, select, update } from './supabase'

type DeploymentRow = {
  id: string
  project_id: string
  status: DeploymentStatus
  attempt_number: number
  parent_deployment_id: string | null
  docker_image_id: string | null
  container_id: string | null
  created_at: string
  completed_at: string | null
}

function rowToDeployment(row: DeploymentRow): Deployment {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    attemptNumber: row.attempt_number,
    parentDeploymentId: row.parent_deployment_id,
    dockerImageId: row.docker_image_id,
    containerId: row.container_id,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }
}

export async function createDeployment(data: {
  projectId: string
  attemptNumber?: number
  parentDeploymentId?: string
}): Promise<Deployment> {
  const row = await insert<DeploymentRow>('visa_deployments', {
    id: randomUUID(),
    project_id: data.projectId,
    status: 'PENDING',
    attempt_number: data.attemptNumber ?? 1,
    parent_deployment_id: data.parentDeploymentId ?? null,
  })
  return rowToDeployment(row)
}

export async function getDeploymentById(id: string): Promise<Deployment | undefined> {
  const rows = await select<DeploymentRow>('visa_deployments', { id })
  return rows[0] ? rowToDeployment(rows[0]) : undefined
}

export async function updateDeploymentStatus(
  id: string,
  status: DeploymentStatus,
  extra?: { dockerImageId?: string; containerId?: string }
): Promise<void> {
  const terminal: DeploymentStatus[] = ['LIVE', 'TERMINAL', 'FAILED']
  const patch: Record<string, unknown> = { status }
  if (extra?.dockerImageId) patch.docker_image_id = extra.dockerImageId
  if (extra?.containerId) patch.container_id = extra.containerId
  if (terminal.includes(status)) patch.completed_at = new Date().toISOString()
  await update('visa_deployments', { id }, patch)
}

export async function listDeploymentsByProject(projectId: string): Promise<Deployment[]> {
  const rows = await select<DeploymentRow>(
    'visa_deployments',
    { project_id: projectId },
    { order: 'created_at.desc' }
  )
  return rows.map(rowToDeployment)
}

export async function appendLog(data: {
  deploymentId: string
  source: string
  lineNumber: number
  content: string
}): Promise<void> {
  await insert('visa_deployment_logs', {
    deployment_id: data.deploymentId,
    source: data.source,
    line_number: data.lineNumber,
    content: data.content,
  })
}

export async function getLogs(deploymentId: string): Promise<Array<{
  lineNumber: number
  source: string
  content: string
  timestamp: string
}>> {
  const rows = await select<{
    line_number: number
    source: string
    content: string
    timestamp: string
  }>('visa_deployment_logs', { deployment_id: deploymentId }, { order: 'line_number.asc' })
  return rows.map(r => ({
    lineNumber: r.line_number,
    source: r.source,
    content: r.content,
    timestamp: r.timestamp,
  }))
}

export async function countDeploymentsByProject(projectId: string): Promise<number> {
  return count('visa_deployments', { project_id: projectId })
}
