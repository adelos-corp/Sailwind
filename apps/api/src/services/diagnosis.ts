import fs from 'fs'
import path from 'path'
import type { Diagnosis } from '../types'

// ─── Diagnose a deployment failure ────────────────────────────────────────────
// Deterministic static analysis — no LLM required.

export interface DiagnosisInput {
  containerLogs: string[]
  projectPath: string
  envVarsNeeded: string[]        // from analysis
  envVarsProvided: Record<string, string>  // what we passed to docker run
}

export interface DiagnosisResult {
  failureType: Diagnosis['failureType']
  rootCause: string
  proposedCorrection: ProposedCorrection
  confidence: number
  rationale: string
}

export interface ProposedCorrection {
  type: 'ADD_ENV_VAR' | 'FIX_DOCKERFILE' | 'FIX_CODE' | 'MANUAL'
  description: string
  // For ADD_ENV_VAR: the env var to add and its safe placeholder value
  envVar?: string
  envValue?: string
  // For FIX_DOCKERFILE: the before/after Dockerfile diff
  dockerfilePatch?: {
    search: string
    replace: string
  }
  // Human-readable diff shown in UI before approval
  diff: string
}

export function diagnose(input: DiagnosisInput): DiagnosisResult {
  const logText = input.containerLogs.join('\n')

  // Pattern 1: Missing required env var — process.exit(1) with our known message
  const missingEnvMatch = logText.match(/\[fatal\]\s+(\w+)\s+environment variable is required/)
  if (missingEnvMatch) {
    const varName = missingEnvMatch[1]
    const diff = buildEnvDiff(input.projectPath, varName, 'sailwind-demo-secret')
    return {
      failureType: 'CORRECTABLE',
      rootCause: `Required environment variable ${varName} is not set. The application exits immediately on startup.`,
      proposedCorrection: {
        type: 'ADD_ENV_VAR',
        description: `Add ENV ${varName}=sailwind-demo-secret to Dockerfile`,
        envVar: varName,
        envValue: 'sailwind-demo-secret',
        dockerfilePatch: {
          search: 'CMD ["node", "server.js"]',
          replace: `ENV ${varName}=sailwind-demo-secret\nCMD ["node", "server.js"]`,
        },
        diff,
      },
      confidence: 0.98,
      rationale: `Log line "[fatal] ${varName} environment variable is required" directly indicates missing env var. Correction: add ENV to Dockerfile before CMD.`,
    }
  }

  // Pattern 2: Generic process.env reference without our custom message
  const envRefPattern = /Cannot read propert(?:y|ies) of undefined|TypeError.*env/
  if (envRefPattern.test(logText)) {
    return {
      failureType: 'CORRECTABLE',
      rootCause: 'Application crashed due to undefined environment variable access.',
      proposedCorrection: {
        type: 'MANUAL',
        description: 'Review required env vars and add them to Dockerfile or runtime config.',
        diff: '// Manual review required — check process.env references in application code.',
      },
      confidence: 0.6,
      rationale: 'TypeError pattern detected in logs suggesting missing env var, but cannot determine exact variable name.',
    }
  }

  // Pattern 3: Port already in use
  if (logText.includes('EADDRINUSE') || logText.includes('address already in use')) {
    return {
      failureType: 'NEEDS_HUMAN',
      rootCause: 'Port conflict — the container port is already in use on the host.',
      proposedCorrection: {
        type: 'MANUAL',
        description: 'Free the port or change the PORT env var.',
        diff: '// Change PORT env var or stop conflicting process.',
      },
      confidence: 0.9,
      rationale: 'EADDRINUSE detected in container logs.',
    }
  }

  // Pattern 4: Build failed
  if (logText.includes('npm ERR!') || logText.includes('yarn error')) {
    return {
      failureType: 'NEEDS_HUMAN',
      rootCause: 'Dependency installation failed during Docker build.',
      proposedCorrection: {
        type: 'MANUAL',
        description: 'Check package.json for invalid/missing dependency versions.',
        diff: '// Review package.json and lockfile.',
      },
      confidence: 0.85,
      rationale: 'npm/yarn error lines detected in build logs.',
    }
  }

  // Fallback
  return {
    failureType: 'UNRECOVERABLE',
    rootCause: 'Container exited unexpectedly. Root cause could not be automatically determined.',
    proposedCorrection: {
      type: 'MANUAL',
      description: 'Manual investigation required. Review full deployment logs.',
      diff: '// No automatic correction available.',
    },
    confidence: 0.3,
    rationale: 'No recognizable failure pattern matched in container logs.',
  }
}

function buildEnvDiff(projectPath: string, varName: string, value: string): string {
  const dfPath = path.join(projectPath, 'Dockerfile')
  if (!fs.existsSync(dfPath)) {
    return `+ENV ${varName}=${value}  (add before CMD in Dockerfile)`
  }
  const before = fs.readFileSync(dfPath, 'utf8').trimEnd()
  const lines = before.split('\n')
  const diff: string[] = ['--- Dockerfile (before)', '+++ Dockerfile (after)']
  let injected = false
  for (const line of lines) {
    if (!injected && /^CMD\s/.test(line)) {
      diff.push(`-${line}`)
      diff.push(`+ENV ${varName}=${value}`)
      diff.push(`+${line}`)
      injected = true
    } else {
      diff.push(` ${line}`)
    }
  }
  if (!injected) {
    diff.push(`+ENV ${varName}=${value}`)
  }
  return diff.join('\n')
}
