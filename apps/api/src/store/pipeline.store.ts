import { randomUUID } from 'crypto'
import type { ProjectAnalysis, Diagnosis, Verification } from '../types'
import { count, insert, select } from './supabase'

export interface CheckResult {
  name: string
  status: 'PASS' | 'WARN' | 'FAIL'
  message: string
}

export interface DeploymentPlan {
  imageTag: string
  port: number
  healthPath: string
  envVars: Record<string, string>
  steps: string[]
  sourceUrl?: string
}

export async function upsertAnalysis(data: {
  projectId: string
  framework: string
  runtime: string
  port: number
  healthPath: string
  buildCommand: string
  envVarsNeeded: string[]
  rawJson: string
}): Promise<ProjectAnalysis> {
  const row = await insert<Record<string, unknown>>('visa_project_analyses', {
    id: randomUUID(),
    project_id: data.projectId,
    framework: data.framework,
    runtime: data.runtime,
    port: data.port,
    health_path: data.healthPath,
    build_command: data.buildCommand,
    env_vars_needed: data.envVarsNeeded,
    raw_json: data.rawJson,
  })
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    framework: row.framework as string,
    runtime: row.runtime as string,
    port: row.port as number,
    healthPath: row.health_path as string,
    buildCommand: row.build_command as string,
    envVarsNeeded: row.env_vars_needed as string[],
    rawJson: row.raw_json as string,
    createdAt: row.created_at as string,
  }
}

export async function getAnalysisByProject(projectId: string): Promise<ProjectAnalysis | undefined> {
  const rows = await select<Record<string, unknown>>(
    'visa_project_analyses',
    { project_id: projectId },
    { order: 'created_at.desc', limit: 1 }
  )
  const row = rows[0]
  if (!row) return undefined
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    framework: row.framework as string,
    runtime: row.runtime as string,
    port: row.port as number,
    healthPath: row.health_path as string,
    buildCommand: row.build_command as string,
    envVarsNeeded: row.env_vars_needed as string[],
    rawJson: row.raw_json as string,
    createdAt: row.created_at as string,
  }
}

export async function savePreCheckReport(data: {
  deploymentId: string
  checks: CheckResult[]
  overallStatus: 'PASS' | 'WARN' | 'FAIL'
}): Promise<string> {
  const id = randomUUID()
  await insert('visa_pre_check_reports', {
    id,
    deployment_id: data.deploymentId,
    checks_json: data.checks,
    overall_status: data.overallStatus,
  })
  return id
}

export async function getPreCheckReport(deploymentId: string): Promise<{
  id: string
  checks: CheckResult[]
  overallStatus: string
} | undefined> {
  const rows = await select<Record<string, unknown>>(
    'visa_pre_check_reports',
    { deployment_id: deploymentId },
    { order: 'created_at.desc', limit: 1 }
  )
  const row = rows[0]
  if (!row) return undefined
  return {
    id: row.id as string,
    checks: row.checks_json as CheckResult[],
    overallStatus: row.overall_status as string,
  }
}

export async function savePlan(deploymentId: string, plan: DeploymentPlan): Promise<string> {
  const id = randomUUID()
  await insert('visa_deployment_plans', {
    id,
    deployment_id: deploymentId,
    plan_json: plan,
  })
  return id
}

export async function getPlan(deploymentId: string): Promise<DeploymentPlan | undefined> {
  const rows = await select<{ plan_json: DeploymentPlan }>(
    'visa_deployment_plans',
    { deployment_id: deploymentId },
    { order: 'created_at.desc', limit: 1 }
  )
  return rows[0]?.plan_json
}

export async function saveDiagnosis(data: {
  deploymentId: string
  failureType: 'CORRECTABLE' | 'NEEDS_HUMAN' | 'UNRECOVERABLE'
  rootCause: string
  proposedCorrection: Record<string, unknown>
  confidence: number
  rationale: string
}): Promise<Diagnosis> {
  const id = randomUUID()
  const row = await insert<Record<string, unknown>>('visa_diagnoses', {
    id,
    deployment_id: data.deploymentId,
    failure_type: data.failureType,
    root_cause: data.rootCause,
    proposed_correction_json: data.proposedCorrection,
    confidence: data.confidence,
    rationale: data.rationale,
  })
  return {
    id: row.id as string,
    deploymentId: row.deployment_id as string,
    failureType: row.failure_type as Diagnosis['failureType'],
    rootCause: row.root_cause as string,
    proposedCorrectionJson: JSON.stringify(row.proposed_correction_json),
    confidence: row.confidence as number,
    rationale: row.rationale as string,
    createdAt: row.created_at as string,
  }
}

export async function getDiagnosis(deploymentId: string): Promise<Diagnosis | undefined> {
  const rows = await select<Record<string, unknown>>(
    'visa_diagnoses',
    { deployment_id: deploymentId },
    { order: 'created_at.desc', limit: 1 }
  )
  const row = rows[0]
  if (!row) return undefined
  return {
    id: row.id as string,
    deploymentId: row.deployment_id as string,
    failureType: row.failure_type as Diagnosis['failureType'],
    rootCause: row.root_cause as string,
    proposedCorrectionJson: JSON.stringify(row.proposed_correction_json),
    confidence: row.confidence as number,
    rationale: row.rationale as string,
    createdAt: row.created_at as string,
  }
}

export async function saveCorrectionAttempt(data: {
  deploymentId: string
  diagnosisId: string
  patchJson: Record<string, unknown>
}): Promise<string> {
  const id = randomUUID()
  await insert('visa_correction_attempts', {
    id,
    deployment_id: data.deploymentId,
    diagnosis_id: data.diagnosisId,
    patch_json: data.patchJson,
    validation_status: 'APPLIED',
  })
  return id
}

export async function countCorrectionAttempts(deploymentId: string): Promise<number> {
  return count('visa_correction_attempts', { deployment_id: deploymentId })
}

export async function saveVerification(data: {
  deploymentId: string
  endpoint: string
  httpStatus: number | null
  responseTimeMs: number | null
  healthy: boolean
  attempts: number
}): Promise<Verification> {
  const id = randomUUID()
  const completedAt = new Date().toISOString()
  await insert('visa_verifications', {
    id,
    deployment_id: data.deploymentId,
    endpoint: data.endpoint,
    http_status: data.httpStatus,
    response_time_ms: data.responseTimeMs,
    healthy: data.healthy,
    attempts: data.attempts,
    completed_at: completedAt,
  })
  return {
    id,
    deploymentId: data.deploymentId,
    endpoint: data.endpoint,
    httpStatus: data.httpStatus,
    responseTimeMs: data.responseTimeMs,
    healthy: data.healthy,
    attempts: data.attempts,
    completedAt,
  }
}
