#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const API_BASE = process.env.Sailwind_API_URL ?? 'http://localhost:3001'

// ─── HTTP helper ─────────────────────────────────────────────────────────────

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  const body = await res.json()
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return body as T
}

function text(t: string) {
  return { content: [{ type: 'text' as const, text: t }] }
}

function errText(err: unknown) {
  return { content: [{ type: 'text' as const, text: String(err) }], isError: true as const }
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new McpServer({ name: 'sailwind-mcp', version: '0.1.0' })

// ── Projects ──────────────────────────────────────────────────────────────────

server.registerTool(
  'sailwind_list_projects',
  { description: 'List all Sailwind-managed projects.' },
  async () => {
    try {
      const data = await api<{ projects: unknown[] }>('/projects')
      return text(JSON.stringify(data, null, 2))
    } catch (err) {
      return errText(err)
    }
  }
)

server.registerTool(
  'sailwind_create_project',
  {
    description:
      'Create a new Sailwind project from a Git URL or local filesystem path, then immediately trigger its first deployment. Returns the created project and deployment.',
    inputSchema: {
      source: z
        .string()
        .describe('A Git URL (https://github.com/…) or an absolute local path'),
      name: z.string().optional().describe('Optional display name for the project'),
    },
  },
  async ({ source, name }) => {
    try {
      const isGit =
        source.startsWith('https://') ||
        source.startsWith('git@') ||
        source.endsWith('.git')

      const projectPayload = isGit
        ? { gitUrl: source, name }
        : { localPath: source, name }

      const { project } = await api<{ project: { id: string } }>('/projects', {
        method: 'POST',
        body: JSON.stringify(projectPayload),
      })

      const { deployment } = await api<{ deployment: unknown }>(
        `/projects/${project.id}/deployments`,
        { method: 'POST' }
      )

      return text(JSON.stringify({ project, deployment }, null, 2))
    } catch (err) {
      return errText(err)
    }
  }
)

server.registerTool(
  'sailwind_get_project',
  {
    description: 'Get details of a specific Sailwind project, including all its deployments.',
    inputSchema: {
      projectId: z.string().describe('The project UUID'),
    },
  },
  async ({ projectId }) => {
    try {
      const [projectData, deploymentsData] = await Promise.all([
        api<{ project: unknown }>(`/projects/${projectId}`),
        api<{ deployments: unknown[] }>(`/projects/${projectId}/deployments`),
      ])
      return text(JSON.stringify({ ...projectData, ...deploymentsData }, null, 2))
    } catch (err) {
      return errText(err)
    }
  }
)

// ── Deployments ───────────────────────────────────────────────────────────────

server.registerTool(
  'sailwind_get_deployment',
  {
    description: 'Get the current status and metadata of a deployment.',
    inputSchema: {
      deploymentId: z.string().describe('The deployment UUID'),
    },
  },
  async ({ deploymentId }) => {
    try {
      const data = await api<unknown>(`/deployments/${deploymentId}`)
      return text(JSON.stringify(data, null, 2))
    } catch (err) {
      return errText(err)
    }
  }
)

server.registerTool(
  'sailwind_get_deployment_logs',
  {
    description: 'Retrieve the log lines produced during a deployment run.',
    inputSchema: {
      deploymentId: z.string().describe('The deployment UUID'),
    },
  },
  async ({ deploymentId }) => {
    try {
      const data = await api<{
        logs: Array<{ lineNumber: number; source: string; content: string }>
      }>(`/deployments/${deploymentId}/logs`)
      const lines = data.logs
        .map((l) => `[${l.lineNumber}] [${l.source}] ${l.content}`)
        .join('\n')
      return text(lines || '(no logs)')
    } catch (err) {
      return errText(err)
    }
  }
)

server.registerTool(
  'sailwind_approve_deployment',
  {
    description:
      'Submit an approval or rejection at a Sailwind gate. Use gate="DEPLOY" for initial deployment approval, gate="CORRECT" when approving an auto-correction after a failure.',
    inputSchema: {
      deploymentId: z.string().describe('The deployment UUID'),
      gate: z.enum(['DEPLOY', 'CORRECT']).describe('Which gate to act on'),
      decision: z.enum(['APPROVED', 'REJECTED']).describe('Approve or reject'),
      notes: z.string().optional().describe('Optional human-readable notes'),
    },
  },
  async ({ deploymentId, gate, decision, notes }) => {
    try {
      const data = await api<unknown>(`/deployments/${deploymentId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ gate, decision, notes }),
      })
      return text(JSON.stringify(data, null, 2))
    } catch (err) {
      return errText(err)
    }
  }
)

server.registerTool(
  'sailwind_trigger_deployment',
  {
    description: 'Trigger a new deployment attempt for an existing Sailwind project.',
    inputSchema: {
      projectId: z.string().describe('The project UUID'),
    },
  },
  async ({ projectId }) => {
    try {
      const data = await api<unknown>(`/projects/${projectId}/deployments`, {
        method: 'POST',
      })
      return text(JSON.stringify(data, null, 2))
    } catch (err) {
      return errText(err)
    }
  }
)

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('sailwind-mcp running on stdio')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
