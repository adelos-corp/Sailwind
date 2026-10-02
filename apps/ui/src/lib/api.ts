// Typed API client for the Sailwind backend

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001')

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeploymentStatus =
  | 'PENDING'
  | 'ANALYZING'
  | 'CHECKING'
  | 'AWAITING_APPROVAL'
  | 'DEPLOYING'
  | 'VERIFYING'
  | 'LIVE'
  | 'FAILED'
  | 'CORRECTING'
  | 'TERMINAL'

export interface Project {
  id: string
  gitUrl: string | null
  localPath: string | null
  name: string
  createdAt: string
}

export interface Deployment {
  id: string
  projectId: string
  status: DeploymentStatus
  attemptNumber: number
  parentDeploymentId: string | null
  dockerImageId: string | null
  containerId: string | null
  createdAt: string
  completedAt: string | null
}

export interface LogEntry {
  lineNumber: number
  source: string
  content: string
  timestamp: string
}

export interface DeploymentEvent {
  type: 'stage' | 'log' | 'status' | 'error'
  deploymentId: string
  payload: Record<string, unknown>
  timestamp: string
}

// ─── Projects ────────────────────────────────────────────────────────────────

export const projects = {
  list(): Promise<{ projects: Project[] }> {
    return request('/projects')
  },

  get(id: string): Promise<{ project: Project }> {
    return request(`/projects/${id}`)
  },

  create(data: {
    name?: string
    gitUrl?: string
    localPath?: string
  }): Promise<{ project: Project }> {
    return request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  listDeployments(id: string): Promise<{ deployments: Deployment[] }> {
    return request(`/projects/${id}/deployments`)
  },

  createDeployment(id: string): Promise<{ deployment: Deployment }> {
    return request(`/projects/${id}/deployments`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  },
}

// ─── Deployments ─────────────────────────────────────────────────────────────

export const deployments = {
  get(id: string): Promise<{ deployment: Deployment }> {
    return request(`/deployments/${id}`)
  },

  getLogs(id: string): Promise<{ deploymentId: string; logs: LogEntry[] }> {
    return request(`/deployments/${id}/logs`)
  },

  approve(
    id: string,
    data: {
      gate: 'DEPLOY' | 'CORRECT'
      decision: 'APPROVED' | 'REJECTED'
      notes?: string
    }
  ): Promise<{ approvalId: string; gate: string; decision: string }> {
    return request(`/deployments/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  run(id: string): Promise<{ started: boolean }> {
    return request(`/deployments/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
  },

  getChecks(id: string): Promise<{ deploymentId: string; report: { checks: Array<{ name: string; status: string; message: string }>; overallStatus: string } | null }> {
    return request(`/deployments/${id}/checks`)
  },

  getPlan(id: string): Promise<{ deploymentId: string; plan: { imageTag: string; port: number; healthPath: string; envVars: Record<string, string>; steps: string[] } | null }> {
    return request(`/deployments/${id}/plan`)
  },

  getDiagnosis(id: string): Promise<{ deploymentId: string; diagnosis: { id: string; failureType: string; rootCause: string; proposedCorrectionJson: string; confidence: number; rationale: string } | null }> {
    return request(`/deployments/${id}/diagnosis`)
  },

  /**
   * Opens an SSE connection to `/deployments/:id/events`.
   * Returns an EventSource. Call `.close()` when done.
   */
  streamEvents(
    id: string,
    onEvent: (event: DeploymentEvent) => void,
    onError?: (err: Event) => void
  ): EventSource {
    const es = new EventSource(`${API_BASE}/deployments/${id}/events`)
    es.onmessage = (e) => {
      try {
        onEvent(JSON.parse(e.data) as DeploymentEvent)
      } catch {
        // ignore parse errors
      }
    }
    if (onError) es.onerror = onError
    return es
  },
}
