import { randomUUID } from 'crypto'
import type { Project } from '../types'
import { insert, select } from './supabase'

type ProjectRow = {
  id: string
  name: string
  git_url: string | null
  local_path: string | null
  created_at: string
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    gitUrl: row.git_url,
    localPath: row.local_path,
    createdAt: row.created_at,
  }
}

export async function createProject(data: {
  name: string
  gitUrl?: string
  localPath?: string
}): Promise<Project> {
  const row = await insert<ProjectRow>('visa_projects', {
    id: randomUUID(),
    name: data.name,
    git_url: data.gitUrl ?? null,
    local_path: data.localPath ?? null,
  })
  return rowToProject(row)
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  const rows = await select<ProjectRow>('visa_projects', { id })
  return rows[0] ? rowToProject(rows[0]) : undefined
}

export async function listProjects(): Promise<Project[]> {
  const rows = await select<ProjectRow>('visa_projects', {}, { order: 'created_at.desc' })
  return rows.map(rowToProject)
}
