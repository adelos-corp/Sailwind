import fs from 'fs'
import path from 'path'
import type { DiagnosisResult, ProposedCorrection } from './diagnosis'

const GRANITE_MODEL = process.env.GRANITE_MODEL ?? 'ibm/granite4.2:3b'
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL ?? (process.env.VERCEL === '1' ? 'https://ollama.com' : 'http://127.0.0.1:11434')).replace(/\/$/, '')
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY
const GRANITE_TIMEOUT_MS = Number(process.env.GRANITE_TIMEOUT_MS ?? '20000')

interface GraniteSignal {
  failureType: DiagnosisResult['failureType']
  rootCause: string
  confidence: number
  rationale: string
  correctionType: ProposedCorrection['type']
  envVar?: string
  envValue?: string
}

export async function diagnoseWithGranite(input: {
  containerLogs: string[]
  projectPath: string
  fallback: () => DiagnosisResult
}): Promise<{ result: DiagnosisResult; modelUsed: string; usedFallback: boolean; durationMs: number; error?: string }> {
  const started = Date.now()
  const fallback = input.fallback()

  try {
    const dockerfilePath = path.join(input.projectPath, 'Dockerfile')
    const dockerfile = fs.existsSync(dockerfilePath)
      ? fs.readFileSync(dockerfilePath, 'utf8').slice(0, 5000)
      : ''

    const logs = input.containerLogs.join('\n').slice(-5000)
    const prompt = [
      'Diagnose this Docker deployment failure for Sailwind.',
      'Return ONLY compact JSON matching this schema:',
      '{"failureType":"CORRECTABLE|NEEDS_HUMAN|UNRECOVERABLE","rootCause":"string","confidence":0,"rationale":"string","correctionType":"ADD_ENV_VAR|MANUAL","envVar":"optional","envValue":"optional"}',
      'If a missing environment variable caused the crash, correctionType MUST be ADD_ENV_VAR and you MUST provide envVar and envValue. Do not use FIX_DOCKERFILE.',
      'For this demo, if APP_SECRET is missing, use envVar="APP_SECRET" and envValue="sailwind-demo-secret".',
      'Only recommend a bounded Dockerfile correction. Never propose shell commands or arbitrary code changes.',
      '',
      'LOGS:',
      logs,
      '',
      'DOCKERFILE:',
      dockerfile,
    ].join('\n')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), GRANITE_TIMEOUT_MS)

    const response = await fetch(OLLAMA_BASE_URL + '/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(OLLAMA_API_KEY ? { authorization: 'Bearer ' + OLLAMA_API_KEY } : {}),
      },
      body: JSON.stringify({
        model: GRANITE_MODEL,
        stream: false,
        format: 'json',
        think: false,
        keep_alive: '5m',
        options: {
          temperature: 0,
          num_predict: 128,
        },
        messages: [
          {
            role: 'system',
            content: 'You are Sailwind deployment diagnosis. Be concise, deterministic, and return JSON only.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!response.ok) throw new Error('Granite endpoint returned HTTP ' + response.status)

    const body = await response.json() as { message?: { content?: string } }
    const content = body.message?.content
    if (!content) throw new Error('Granite returned no message content')

    const signal = JSON.parse(content) as GraniteSignal
    const result = materializeDiagnosis(signal, input.projectPath, fallback)

    return {
      result,
      modelUsed: GRANITE_MODEL,
      usedFallback: false,
      durationMs: Date.now() - started,
    }
  } catch (error) {
    return {
      result: fallback,
      modelUsed: GRANITE_MODEL,
      usedFallback: true,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function materializeDiagnosis(signal: GraniteSignal, projectPath: string, fallback: DiagnosisResult): DiagnosisResult {
  const allowedFailureTypes: DiagnosisResult['failureType'][] = ['CORRECTABLE', 'NEEDS_HUMAN', 'UNRECOVERABLE']
  const allowedCorrectionTypes: ProposedCorrection['type'][] = ['ADD_ENV_VAR', 'MANUAL']

  if (!allowedFailureTypes.includes(signal.failureType)) return fallback
  if (!signal.rootCause || !signal.rationale) return fallback
  if (!allowedCorrectionTypes.includes(signal.correctionType)) return fallback

  if (signal.correctionType === 'ADD_ENV_VAR') {
    if (!signal.envVar || !/^[A-Z_][A-Z0-9_]*$/.test(signal.envVar)) return fallback
    if (!signal.envValue) return fallback

    const dockerfilePath = path.join(projectPath, 'Dockerfile')
    if (!fs.existsSync(dockerfilePath)) return fallback
    const current = fs.readFileSync(dockerfilePath, 'utf8')
    const search = current.includes('CMD ["node", "server.js"]')
      ? 'CMD ["node", "server.js"]'
      : 'CMD '
    if (!current.includes(search)) return fallback

    const replace = `ENV ${signal.envVar}=${signal.envValue}\n${search}`
    const diff = `--- Dockerfile (before)\n+++ Dockerfile (after)\n@@\n ${search}\n+${replace}`

    return {
      failureType: signal.failureType,
      rootCause: signal.rootCause,
      confidence: Math.max(0, Math.min(1, Number(signal.confidence) || 0)),
      rationale: signal.rationale,
      proposedCorrection: {
        type: 'ADD_ENV_VAR',
        description: `Add ENV ${signal.envVar}=${signal.envValue} to Dockerfile`,
        envVar: signal.envVar,
        envValue: signal.envValue,
        dockerfilePatch: { search, replace },
        diff,
      },
    }
  }

  return {
    failureType: signal.failureType,
    rootCause: signal.rootCause,
    confidence: Math.max(0, Math.min(1, Number(signal.confidence) || 0)),
    rationale: signal.rationale,
    proposedCorrection: {
      type: signal.correctionType,
      description: signal.correctionType === 'MANUAL' ? 'Manual intervention required.' : 'Review the proposed Dockerfile correction.',
      diff: 'No automatic patch generated.',
    },
  }
}
