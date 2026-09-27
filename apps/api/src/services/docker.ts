import { execa } from 'execa'
import { Sandbox } from '@vercel/sandbox'
import type { DeploymentPlan } from '../store/pipeline.store'

export interface DockerBuildResult { imageId: string; logs: string[] }
export interface DockerRunResult { containerId: string; port: number }

const USE_VERCEL_SANDBOX = process.env.VERCEL === '1' || process.env.RUNNER_MODE === 'vercel-sandbox'
const PROJECT_DIR = '/vercel/sandbox/project'

// Container-based Vercel runtimes do not expose the Sandbox OIDC request context.
// When explicit access-token credentials are configured, pass them to every
// Sandbox lookup/create call so production runners work from the API container.
function sandboxAuth() {
  const token = process.env.VERCEL_TOKEN
  const teamId = process.env.VERCEL_TEAM_ID
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!token || !teamId || !projectId) return {}
  return { token, teamId, projectId }
}

async function getSandbox(name: string, port?: number): Promise<Sandbox> {
  const auth = sandboxAuth()
  try {
    return await Sandbox.get({ name, ...auth })
  } catch {
    return await Sandbox.create({ name, ...auth, ports: port ? [port] : undefined, timeout: 40 * 60 * 1000 })
  }
}

async function ensureDocker(sandbox: Sandbox): Promise<void> {
  // Vercel Sandbox throws a 400 when runCommand is asked to execute a
  // binary that is not installed, rather than returning a non-zero exit code.
  // Treat that as "Docker is missing" and bootstrap it explicitly.
  let dockerReady = false
  try {
    const check = await sandbox.runCommand({ cmd: 'docker', args: ['info'] })
    dockerReady = check.exitCode === 0
  } catch {
    dockerReady = false
  }

  if (dockerReady) return

  const update = await sandbox.runCommand({
    sudo: true,
    cmd: 'apt-get',
    args: ['update'],
  })
  if (update.exitCode !== 0) {
    throw new Error('Docker package index update failed: ' + await update.stderr())
  }

  const install = await sandbox.runCommand({
    sudo: true,
    cmd: 'apt-get',
    args: ['install', '-y', 'docker.io'],
  })
  if (install.exitCode !== 0) {
    throw new Error('Docker installation failed: ' + await install.stderr())
  }

  const daemon = await sandbox.runCommand({
    sudo: true,
    cmd: 'dockerd',
    detached: true,
  })
  if (daemon.exitCode !== 0) {
    throw new Error('Docker daemon failed to start: ' + await daemon.stderr())
  }

  const ready = await sandbox.runCommand({
    cmd: 'sh',
    args: ['-lc', 'for i in $(seq 1 30); do sudo docker info >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1'],
  })
  if (ready.exitCode !== 0) throw new Error('Docker daemon did not become ready')
}


async function prepareSandbox(name: string, port: number): Promise<Sandbox> {
  const sandbox = await getSandbox(name, port)
  await ensureDocker(sandbox)
  return sandbox
}

async function remoteBuild(sourceUrl: string, tag: string, onLog: (line: string) => void): Promise<DockerBuildResult> {
  const sandbox = await prepareSandbox(tag, 18080)
  const exists = await sandbox.runCommand({ cmd: 'sh', args: ['-lc', 'test -d ' + PROJECT_DIR + '/.git'] })
  if (exists.exitCode !== 0) {
    const clone = await sandbox.runCommand({ cmd: 'git', args: ['clone', '--depth', '1', sourceUrl, PROJECT_DIR] })
    if (clone.exitCode !== 0) throw new Error('git clone failed: ' + await clone.stderr())
  }
  const result = await sandbox.runCommand({ cmd: 'docker', args: ['build', '-t', tag, '.'], cwd: PROJECT_DIR })
  const output = (await result.stdout()) + '\n' + (await result.stderr())
  const logs = output.split('\n').filter(Boolean)
  logs.forEach(onLog)
  if (result.exitCode !== 0) throw new Error('docker build failed (exit ' + result.exitCode + ')')
  const inspect = await sandbox.runCommand({ cmd: 'docker', args: ['inspect', '--format={{.Id}}', tag] })
  return { imageId: (await inspect.stdout()).trim() || tag, logs }
}

export async function buildImage(projectPath: string, tag: string, onLog: (line: string) => void): Promise<DockerBuildResult> {
  if (USE_VERCEL_SANDBOX && /^https?:\/\//.test(projectPath)) return remoteBuild(projectPath, tag, onLog)
  const result = await execa('docker', ['build', '-t', tag, '.'], { cwd: projectPath, all: true, reject: false })
  const logs = (result.all ?? '').split('\n').filter(Boolean)
  logs.forEach(onLog)
  if (result.exitCode !== 0) throw new Error('docker build failed (exit ' + result.exitCode + ')')
  const inspect = await execa('docker', ['inspect', '--format={{.Id}}', tag], { reject: false })
  return { imageId: inspect.stdout?.trim() ?? tag, logs }
}

async function isHostPortPublished(port: number): Promise<boolean> {
  const result = await execa('docker', ['ps', '--filter', 'publish=' + port, '--format={{.ID}}'], { reject: false })
  return Boolean((result.stdout ?? '').trim())
}

async function findDockerHostPort(start: number, end = start + 50): Promise<number> {
  for (let port = start; port <= end; port++) {
    if (!(await isHostPortPublished(port))) return port
  }
  throw new Error(`No unused Docker host port found between ${start} and ${end}`)
}

export async function runContainer(tag: string, plan: DeploymentPlan, onLog: (line: string) => void): Promise<DockerRunResult> {
  const preferredPort = USE_VERCEL_SANDBOX ? plan.port + 10000 : await findDockerHostPort(plan.port + 10000)
  const envArgs: string[] = []
  for (const [key, value] of Object.entries(plan.envVars)) envArgs.push('-e', key + '=' + value)
  const containerName = tag.replace(/[^a-z0-9-]/g, '-')

  if (USE_VERCEL_SANDBOX) {
    const hostPort = preferredPort
    const args = ['run', '-d', '--name', containerName, '-p', hostPort + ':' + plan.port, ...envArgs, tag]
    const sandbox = await prepareSandbox(tag, hostPort)
    await sandbox.runCommand({ cmd: 'docker', args: ['rm', '-f', containerName] })
    onLog('docker ' + args.join(' '))
    const result = await sandbox.runCommand({ cmd: 'docker', args })
    if (result.exitCode !== 0) throw new Error('docker run failed: ' + await result.stderr())
    const dockerId = (await result.stdout()).trim()
    onLog('Container started: ' + dockerId.slice(0, 12))
    return { containerId: tag + '::' + dockerId, port: hostPort }
  }

  await execa('docker', ['rm', '-f', containerName], { reject: false })

  for (let offset = 0; offset <= 50; offset++) {
    const hostPort = preferredPort + offset
    if (offset > 0 && await isHostPortPublished(hostPort)) {
      onLog(`Host port ${hostPort} is already published; skipping`)
      continue
    }
    const args = ['run', '-d', '--name', containerName, '-p', hostPort + ':' + plan.port, ...envArgs, tag]
    onLog('docker ' + args.join(' '))
    const result = await execa('docker', args, { reject: false })

    if (result.exitCode === 0) {
      const containerId = result.stdout.trim()
      onLog('Container started: ' + containerId.slice(0, 12))
      if (hostPort !== preferredPort) onLog(`Port ${preferredPort} was unavailable; using ${hostPort}`)
      return { containerId, port: hostPort }
    }

    const errorText = `${result.stderr ?? ''}\n${result.stdout ?? ''}`
    const portConflict = /port is already allocated|address already in use|failed to bind/i.test(errorText)

    if (!portConflict) throw new Error('docker run failed: ' + result.stderr)
    onLog(`Host port ${hostPort} is unavailable; trying ${hostPort + 1}`)
  }

  throw new Error(`No usable Docker host port found in ${preferredPort}-${preferredPort + 50}`)
}
function splitRunnerContainer(containerId: string) {
  const [sandboxName, dockerId] = containerId.split('::')
  if (!sandboxName || !dockerId) throw new Error('Invalid Sandbox container reference')
  return { sandboxName, dockerId }
}

export async function waitForContainerExit(containerId: string, timeoutMs: number, onLog: (line: string) => void) {
  const logs: string[] = []
  const startedAt = Date.now()
  const pollMs = 250

  while (Date.now() - startedAt < timeoutMs) {
    let running = false
    let exitCode = 0

    if (USE_VERCEL_SANDBOX) {
      const { sandboxName, dockerId } = splitRunnerContainer(containerId)
      const sandbox = await getSandbox(sandboxName)
      const inspect = await sandbox.runCommand({ cmd: 'docker', args: ['inspect', '--format={{.State.Running}}|{{.State.ExitCode}}', dockerId] })
      const [runningText, exitText] = (await inspect.stdout()).trim().split('|')
      running = runningText === 'true'
      exitCode = parseInt(exitText || '0', 10)
      if (!running) {
        const result = await sandbox.runCommand({ cmd: 'docker', args: ['logs', '--tail=200', dockerId] })
        const output = (await result.stdout()) + '\n' + (await result.stderr())
        output.split('\n').filter(Boolean).forEach(line => { logs.push(line); onLog(line) })
        return { exitCode, logs }
      }
    } else {
      const inspect = await execa('docker', ['inspect', '--format={{.State.Running}}|{{.State.ExitCode}}', containerId], { reject: false })
      const [runningText, exitText] = (inspect.stdout ?? '').trim().split('|')
      running = runningText === 'true'
      exitCode = parseInt(exitText || '0', 10)
      if (!running) {
        const result = await execa('docker', ['logs', '--tail=200', containerId], { reject: false, all: true })
        ;(result.all ?? '').split('\n').filter(Boolean).forEach(line => { logs.push(line); onLog(line) })
        return { exitCode, logs }
      }
    }

    if (running) {
      await new Promise(resolve => setTimeout(resolve, pollMs))
    } else {
      return { exitCode, logs }
    }
  }

  onLog(`Container remained running after ${timeoutMs}ms — proceeding to health verification`)
  return { exitCode: 0, logs }
}

export async function stopContainer(containerId: string): Promise<void> {
  if (USE_VERCEL_SANDBOX) {
    const { sandboxName, dockerId } = splitRunnerContainer(containerId)
    const sandbox = await getSandbox(sandboxName)
    await sandbox.runCommand({ cmd: 'docker', args: ['stop', dockerId] })
    await sandbox.runCommand({ cmd: 'docker', args: ['rm', '-f', dockerId] })
    return
  }
  await execa('docker', ['stop', containerId], { reject: false })
  await execa('docker', ['rm', '-f', containerId], { reject: false })
}

export async function removeImage(tag: string): Promise<void> {
  if (USE_VERCEL_SANDBOX) {
    const sandbox = await getSandbox(tag)
    await sandbox.runCommand({ cmd: 'docker', args: ['rmi', '-f', tag] })
    return
  }
  await execa('docker', ['rmi', '-f', tag], { reject: false })
}

export async function isContainerRunning(containerId: string): Promise<boolean> {
  if (USE_VERCEL_SANDBOX) {
    const { sandboxName, dockerId } = splitRunnerContainer(containerId)
    const sandbox = await getSandbox(sandboxName)
    const result = await sandbox.runCommand({ cmd: 'docker', args: ['inspect', '--format={{.State.Running}}', dockerId] })
    return (await result.stdout()).trim() === 'true'
  }
  const result = await execa('docker', ['inspect', '--format={{.State.Running}}', containerId], { reject: false })
  return result.stdout?.trim() === 'true'
}

export async function getRunnerEndpoint(tag: string, port: number, healthPath: string): Promise<string> {
  if (!USE_VERCEL_SANDBOX) return 'http://localhost:' + port + healthPath
  const sandbox = await getSandbox(tag, port)
  return sandbox.domain(port) + healthPath
}

export async function syncRunnerFile(tag: string, relativePath: string, content: string): Promise<void> {
  if (!USE_VERCEL_SANDBOX) return
  const sandbox = await getSandbox(tag)
  await sandbox.writeFiles([{ path: PROJECT_DIR + '/' + relativePath, content: Buffer.from(content) }])
}
