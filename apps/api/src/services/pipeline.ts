// Pipeline orchestrator — drives the full VISA workflow for one deployment.
// Called on POST /deployments/:id/run and resumed after approvals.

import path from 'path'
import fs from 'fs'
import { simpleGit } from 'simple-git'
import { getProjectById } from '../store/projects.store'
import {
  getDeploymentById,
  updateDeploymentStatus,
  appendLog,
} from '../store/deployments.store'
import {
  upsertAnalysis,
  savePreCheckReport,
  savePlan,
  getPlan,
  getAnalysisByProject,
  saveDiagnosis,
  getDiagnosis,
  saveCorrectionAttempt,
  countCorrectionAttempts,
  saveVerification,
  type DeploymentPlan,
} from '../store/pipeline.store'
import { analyzeProject } from './analyzer'
import { runPreChecks } from './preChecks'
import { buildImage, runContainer, waitForContainerExit, stopContainer, getRunnerEndpoint, syncRunnerFile } from './docker'
import { diagnose } from './diagnosis'
import { diagnoseWithGranite } from './granite'
import { applyCorrection } from './corrector'
import { emitStatus, emitLog, emitStage } from './sse'

const MAX_CORRECTIONS = 1
const CONTAINER_STARTUP_GRACE_MS = Number(process.env.CONTAINER_STARTUP_GRACE_MS ?? '3000')

// ─── Logger helper ────────────────────────────────────────────────────────────

let _lineCounters: Map<string, number> = new Map()

function log(deploymentId: string, source: string, content: string): void {
  const n = (_lineCounters.get(deploymentId) ?? 0) + 1
  _lineCounters.set(deploymentId, n)
  appendLog({ deploymentId, source, lineNumber: n, content }).catch(err => console.error('[store] appendLog failed', err))
  emitLog(deploymentId, n, source, content)
}

// ─── Public entry points ──────────────────────────────────────────────────────

/** Start the pipeline from PENDING → ANALYZING → ... → AWAITING_APPROVAL */
export async function startPipeline(deploymentId: string): Promise<void> {
  const deployment = await getDeploymentById(deploymentId)
  if (!deployment) throw new Error('Deployment not found')

  const project = await getProjectById(deployment.projectId)
  if (!project) throw new Error('Project not found')

  const projectPath = await resolveProjectPath(project, deploymentId)

  _lineCounters.set(deploymentId, 0)

  try {
    // ── Stage 1: ANALYZING ──────────────────────────────────────────────────
    await transition(deploymentId, 'ANALYZING')
    emitStage(deploymentId, 'analysis', 'RUNNING')
    log(deploymentId, 'visa', `Analyzing project at ${projectPath}`)

    const analysis = analyzeProject(projectPath)
    await upsertAnalysis({ projectId: deployment.projectId, ...analysis })
    log(deploymentId, 'visa', `Framework: ${analysis.framework} | Runtime: ${analysis.runtime} | Port: ${analysis.port}`)
    log(deploymentId, 'visa', `Env vars referenced: ${analysis.envVarsNeeded.join(', ') || 'none'}`)
    emitStage(deploymentId, 'analysis', 'DONE')

    // ── Stage 2: PRE-CHECKS ─────────────────────────────────────────────────
    await transition(deploymentId, 'CHECKING')
    emitStage(deploymentId, 'pre-checks', 'RUNNING')
    log(deploymentId, 'visa', 'Running parallel pre-checks…')

    const { checks, overallStatus } = await runPreChecks(projectPath)
    await savePreCheckReport({ deploymentId, checks, overallStatus })

    for (const c of checks) {
      log(deploymentId, `check:${c.name}`, `[${c.status}] ${c.message}`)
    }
    emitStage(deploymentId, 'pre-checks', overallStatus === 'FAIL' ? 'FAILED' : 'DONE', { overallStatus })

    if (overallStatus === 'FAIL') {
      log(deploymentId, 'visa', 'Pre-checks FAILED — deployment cannot proceed.')
      await transition(deploymentId, 'TERMINAL')
      return
    }

    // ── Stage 3: PLAN ───────────────────────────────────────────────────────
    const tag = `visa-${deploymentId.slice(0, 8)}`
    const plan: DeploymentPlan = {
      imageTag: tag,
      port: analysis.port,
      healthPath: analysis.healthPath,
      // Intentionally empty on the first deployment so the demo can exercise
      // the failure → diagnosis → approval → correction loop.
      envVars: {},
      sourceUrl: project.gitUrl ?? undefined,
      steps: [
        `docker build -t ${tag} ${projectPath}`,
        `docker run -d -p ${analysis.port + 10000}:${analysis.port} ${tag}`,
        `GET http://localhost:${analysis.port + 10000}${analysis.healthPath}`,
      ],
    }
    await savePlan(deploymentId, plan)
    log(deploymentId, 'visa', `Plan: image=${tag} port=${analysis.port} health=${analysis.healthPath}`)
    log(deploymentId, 'visa', `Env vars to inject: ${JSON.stringify(plan.envVars)}`)
    for (const step of plan.steps) log(deploymentId, 'plan', step)

    // ── Gate 1: AWAITING_APPROVAL ────────────────────────────────────────────
    await transition(deploymentId, 'AWAITING_APPROVAL')
    log(deploymentId, 'visa', 'Waiting for human approval before deployment…')
    // Pipeline pauses here — resumed by resumeAfterApproval()

  } catch (err) {
    log(deploymentId, 'visa', `Pipeline error: ${err}`)
    await transition(deploymentId, 'FAILED')
    emitStage(deploymentId, 'pipeline', 'FAILED')
  }
}

/** Resume after Gate 1 approval — runs docker build+run, then monitor */
export async function resumeAfterDeployApproval(deploymentId: string): Promise<void> {
  const deployment = getDeploymentById(deploymentId)
  if (!deployment) return

  const project = getProjectById(deployment.projectId)
  if (!project?.localPath && !project?.gitUrl) {
    log(deploymentId, 'visa', 'Error: project source is not set')
    transition(deploymentId, 'TERMINAL')
    return
  }

  const plan = await getPlan(deploymentId)
  if (!plan) {
    log(deploymentId, 'visa', 'Error: no deployment plan found')
    transition(deploymentId, 'TERMINAL')
    return
  }

  try {
    // ── Stage 4: DEPLOYING ──────────────────────────────────────────────────
    await transition(deploymentId, 'DEPLOYING')
    emitStage(deploymentId, 'deploy', 'RUNNING')
    log(deploymentId, 'visa', `Building Docker image: ${plan.imageTag}`)

    const buildProjectPath = await resolveProjectPath(project, deploymentId)
    const buildSource = process.env.VERCEL === '1' || process.env.RUNNER_MODE === 'vercel-sandbox'
      ? project.gitUrl!
      : buildProjectPath
    await buildImage(buildSource, plan.imageTag, line =>
      log(deploymentId, 'docker:build', line)
    )

    log(deploymentId, 'visa', 'Build complete — starting container')
    const { containerId, port: hostPort } = await runContainer(plan.imageTag, plan, line =>
      log(deploymentId, 'docker:run', line)
    )
    const runtimePlan: DeploymentPlan = {
      ...plan,
      steps: plan.steps.map(step =>
        step
          .replace(/-p \d+:\d+/, `-p ${hostPort}:${plan.port}`)
          .replace(/localhost:\d+/, `localhost:${hostPort}`)
      ),
    }
    await savePlan(deploymentId, runtimePlan)
    log(deploymentId, 'visa', `Runtime host port allocated: ${hostPort}`)
    await updateDeploymentStatus(deploymentId, 'DEPLOYING', { containerId })

    log(deploymentId, 'visa', `Watching container startup (${containerId.slice(0, 12)})…`)
    const { exitCode, logs: containerLogs } = await waitForContainerExit(containerId, CONTAINER_STARTUP_GRACE_MS, line =>
      log(deploymentId, 'container', line)
    )

    if (exitCode !== 0) {
      emitStage(deploymentId, 'deploy', 'FAILED')
      log(deploymentId, 'visa', `Container exited with code ${exitCode} — running diagnosis`)
      await runDiagnosis(deploymentId, containerLogs, buildProjectPath, plan)
      return
    }

    // ── Stage 5: VERIFYING ──────────────────────────────────────────────────
    await runVerification(deploymentId, hostPort, plan, containerId, buildProjectPath)

  } catch (err) {
    log(deploymentId, 'visa', `Deploy error: ${err}`)
    transition(deploymentId, 'FAILED')
    emitStage(deploymentId, 'deploy', 'FAILED')
  }
}

/** Resume after Gate 2 (correction approval) — apply fix + redeploy */
export async function resumeAfterCorrectionApproval(deploymentId: string): Promise<void> {
  const deployment = getDeploymentById(deploymentId)
  if (!deployment) return

  const project = getProjectById(deployment.projectId)
  if (!project?.localPath && !project?.gitUrl) {
    log(deploymentId, 'visa', 'Error: project source is not set')
    transition(deploymentId, 'TERMINAL')
    return
  }

  const diag = await getDiagnosis(deploymentId)
  if (!diag) {
    log(deploymentId, 'visa', 'Error: no diagnosis found')
    transition(deploymentId, 'TERMINAL')
    return
  }

  const plan = getPlan(deploymentId)
  if (!plan) {
    log(deploymentId, 'visa', 'Error: no plan found')
    transition(deploymentId, 'TERMINAL')
    return
  }

  const corrections = await countCorrectionAttempts(deploymentId)
  if (corrections >= MAX_CORRECTIONS) {
    log(deploymentId, 'visa', `Max correction attempts (${MAX_CORRECTIONS}) reached — marking TERMINAL`)
    transition(deploymentId, 'TERMINAL')
    return
  }

  try {
    await transition(deploymentId, 'CORRECTING')
    emitStage(deploymentId, 'correction', 'RUNNING')

    const correction = JSON.parse(diag.proposedCorrectionJson) as import('./diagnosis').ProposedCorrection
    log(deploymentId, 'visa', `Applying correction: ${correction.description}`)

    const correctionProjectPath = await resolveProjectPath(project, deploymentId + '-correction')
    const result = await applyCorrection(correctionProjectPath, correction)
    if (correction.envVar && correction.envValue) {
      const dockerfile = fs.readFileSync(path.join(correctionProjectPath, 'Dockerfile'), 'utf8')
      await syncRunnerFile(plan.imageTag, 'Dockerfile', dockerfile)
    }
    log(deploymentId, 'visa', result.description)

    await saveCorrectionAttempt({
      deploymentId,
      diagnosisId: diag.id,
      patchJson: { correction, result },
    })

    emitStage(deploymentId, 'correction', result.applied ? 'DONE' : 'FAILED')

    if (!result.applied) {
      log(deploymentId, 'visa', 'Correction could not be applied — marking TERMINAL')
      transition(deploymentId, 'TERMINAL')
      return
    }

    // Carry the approved correction into the deployment plan as well as the
    // Dockerfile patch. This makes the correction explicit and guarantees the
    // redeploy receives the corrected runtime configuration.
    const correctedPlan: DeploymentPlan = {
      ...plan,
      envVars: correction.envVar && correction.envValue
        ? { ...plan.envVars, [correction.envVar]: correction.envValue }
        : plan.envVars,
      steps: plan.steps.map(step =>
        step.startsWith('docker run ')
          ? step.replace(
              'docker run -d',
              correction.envVar && correction.envValue
                ? `docker run -d -e ${correction.envVar}=${correction.envValue}`
                : 'docker run -d'
            )
          : step
      ),
    }
    await savePlan(deploymentId, correctedPlan)

    // Redeploy with updated image
    log(deploymentId, 'visa', 'Rebuilding image after correction…')
    if (correction.envVar && correction.envValue) {
      log(
        deploymentId,
        'visa',
        `Redeploy configuration: injecting approved ${correction.envVar} runtime value`
      )
    }
    transition(deploymentId, 'DEPLOYING')
    emitStage(deploymentId, 'redeploy', 'RUNNING')

    // Stop old container if still around
    const oldDep = await getDeploymentById(deploymentId)
    if (oldDep?.containerId) await stopContainer(oldDep.containerId)

    const redeploySource = process.env.VERCEL === '1' || process.env.RUNNER_MODE === 'vercel-sandbox'
      ? project.gitUrl!
      : correctionProjectPath
    await buildImage(redeploySource, correctedPlan.imageTag, line =>
      log(deploymentId, 'docker:build', line)
    )

    const { containerId, port: hostPort } = await runContainer(correctedPlan.imageTag, correctedPlan, line =>
      log(deploymentId, 'docker:run', line)
    )
    const runtimeCorrectedPlan: DeploymentPlan = {
      ...correctedPlan,
      steps: correctedPlan.steps.map(step =>
        step
          .replace(/-p \d+:\d+/, `-p ${hostPort}:${correctedPlan.port}`)
          .replace(/localhost:\d+/, `localhost:${hostPort}`)
      ),
    }
    await savePlan(deploymentId, runtimeCorrectedPlan)
    log(deploymentId, 'visa', `Runtime host port allocated: ${hostPort}`)
    await updateDeploymentStatus(deploymentId, 'DEPLOYING', { containerId })

    const { exitCode, logs: containerLogs } = await waitForContainerExit(containerId, CONTAINER_STARTUP_GRACE_MS, line =>
      log(deploymentId, 'container', line)
    )

    if (exitCode !== 0) {
      emitStage(deploymentId, 'redeploy', 'FAILED')
      log(deploymentId, 'visa', `Redeployment failed (exit ${exitCode}) — marking TERMINAL`)
      transition(deploymentId, 'TERMINAL')
      return
    }

    emitStage(deploymentId, 'redeploy', 'DONE')
    await runVerification(deploymentId, hostPort, correctedPlan, containerId, correctionProjectPath)

  } catch (err) {
    log(deploymentId, 'visa', `Correction error: ${err}`)
    transition(deploymentId, 'TERMINAL')
  }
}

// ─── Shared sub-routines ──────────────────────────────────────────────────────

async function runVerification(
  deploymentId: string,
  hostPort: number,
  plan: DeploymentPlan,
  containerId: string,
  projectPath: string
): Promise<void> {
  await transition(deploymentId, 'VERIFYING')
  emitStage(deploymentId, 'verification', 'RUNNING')
  const endpoint = await getRunnerEndpoint(plan.imageTag, hostPort, plan.healthPath)
  log(deploymentId, 'visa', `Verifying health at ${endpoint}`)

  const vr = await verifyHealthEndpoint(endpoint, line =>
    log(deploymentId, 'verify', line)
  )
  await saveVerification({
    deploymentId,
    endpoint: vr.endpoint,
    httpStatus: vr.httpStatus,
    responseTimeMs: vr.responseTimeMs,
    healthy: vr.healthy,
    attempts: vr.attempts,
  })

  if (vr.healthy) {
    emitStage(deploymentId, 'verification', 'DONE')
    log(deploymentId, 'visa', `✓ Health check passed in ${vr.attempts} attempt(s)`)
    await transition(deploymentId, 'LIVE')
  } else {
    emitStage(deploymentId, 'verification', 'FAILED')
    log(deploymentId, 'visa', `✗ Health check failed after ${vr.attempts} attempts`)
    await stopContainer(containerId)
    await runDiagnosis(deploymentId, [], projectPath, plan)
  }
}

async function verifyHealthEndpoint(endpoint: string, onLog: (line: string) => void): Promise<{ endpoint: string; httpStatus: number | null; responseTimeMs: number | null; healthy: boolean; attempts: number }> {
  const attempts = 5
  let lastStatus: number | null = null
  let lastTime: number | null = null
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const started = Date.now()
    try {
      const response = await fetch(endpoint)
      lastStatus = response.status
      lastTime = Date.now() - started
      onLog(`Attempt ${attempt}: HTTP ${response.status} (${lastTime}ms)`)
      if (response.ok) return { endpoint, httpStatus: response.status, responseTimeMs: lastTime, healthy: true, attempts: attempt }
    } catch (error) {
      onLog(`Attempt ${attempt}: ${String(error)}`)
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return { endpoint, httpStatus: lastStatus, responseTimeMs: lastTime, healthy: false, attempts }
}

async function resolveProjectPath(project: { localPath: string | null; gitUrl: string | null }, deploymentId: string): Promise<string> {
  if (project.localPath) return project.localPath
  if (!project.gitUrl) throw new Error('Project has no local path or Git URL')
  const target = path.join('/tmp', 'visa-' + deploymentId.replace(/[^a-zA-Z0-9-]/g, '-'))
  if (fs.existsSync(path.join(target, '.git'))) return target
  fs.rmSync(target, { recursive: true, force: true })
  await simpleGit().clone(project.gitUrl, target, ['--depth', '1'])
  return target
}

async function runDiagnosis(
  deploymentId: string,
  containerLogs: string[],
  projectPath: string,
  plan: DeploymentPlan
): Promise<void> {
  transition(deploymentId, 'FAILED')
  emitStage(deploymentId, 'diagnosis', 'RUNNING')
  log(deploymentId, 'visa', 'Running Granite 4.2 3B diagnosis…')

  const corrections = await countCorrectionAttempts(deploymentId)
  if (corrections >= MAX_CORRECTIONS) {
    log(deploymentId, 'visa', 'Max corrections reached — no further auto-correction possible')
    emitStage(deploymentId, 'diagnosis', 'DONE', { failureType: 'UNRECOVERABLE', correctable: false })
    return
  }

  const ai = await diagnoseWithGranite({
    containerLogs,
    projectPath,
    fallback: () => diagnose({
      containerLogs,
      projectPath,
      envVarsNeeded: [],
      envVarsProvided: plan.envVars,
    }),
  })
  const result = ai.result
  log(deploymentId, 'visa', ai.usedFallback
    ? `Granite unavailable after ${ai.durationMs}ms — ${ai.error ?? 'inference failed'}; deterministic diagnosis fallback used (${ai.modelUsed})`
    : `Granite model: ${ai.modelUsed} responded in ${ai.durationMs}ms`)

  const saved = await saveDiagnosis({
    deploymentId,
    failureType: result.failureType,
    rootCause: result.rootCause,
    proposedCorrection: result.proposedCorrection as unknown as Record<string, unknown>,
    confidence: result.confidence,
    rationale: result.rationale,
  })

  log(deploymentId, 'diagnosis', `Type: ${result.failureType} (confidence: ${Math.round(result.confidence * 100)}%)`)
  log(deploymentId, 'diagnosis', `Root cause: ${result.rootCause}`)
  log(deploymentId, 'diagnosis', `Proposed correction: ${result.proposedCorrection.description}`)
  log(deploymentId, 'diagnosis', '--- DIFF ---')
  for (const line of result.proposedCorrection.diff.split('\n')) {
    log(deploymentId, 'diagnosis', line)
  }
  log(deploymentId, 'diagnosis', '--- END DIFF ---')

  emitStage(deploymentId, 'diagnosis', 'DONE', {
    failureType: result.failureType,
    correctable: result.failureType === 'CORRECTABLE',
    diagnosisId: saved.id,
    model: ai.modelUsed,
    usedFallback: ai.usedFallback,
    durationMs: ai.durationMs,
  })
}

async function transition(deploymentId: string, status: import('../types').DeploymentStatus): Promise<void> {
  await updateDeploymentStatus(deploymentId, status)
  emitStatus(deploymentId, status)
}
