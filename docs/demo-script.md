# Sailwind Demo Script

## Goal

Demonstrate the complete deployment recovery loop with the local demo app:

**Analyze → Pre-checks → Approval → Deploy → Fail → Diagnose → Correction Approval → Correct → Redeploy → Verify → LIVE**

## Prerequisites

- Node.js 22 LTS
- pnpm
- Docker Desktop running
- Sailwind API and UI built successfully

## Start Sailwind

Terminal 1:

```bash
cd /Users/abby/.bob/playground/Sailwind
pnpm install
pnpm dev
```

Open `http://localhost:3100`.

Do not run `pnpm demo` for the failure demonstration. Sailwind launches the demo itself in Docker.

## Run the demo

In the Sailwind dashboard, enter:

```
/Users/abby/.bob/playground/Sailwind/samples/demo-app
```

Click **Analyze**.

1. Sailwind analyzes the project.
2. Parallel pre-checks run.
3. Sailwind presents the deployment plan.
4. Approve Gate 1.
5. Docker builds and starts the demo without `APP_SECRET`.
6. The container exits with the deterministic missing-secret error.
7. Sailwind diagnoses the failure as `CORRECTABLE`.
8. Review the proposed Dockerfile diff.
9. Approve Gate 2.
10. Sailwind applies the correction, rebuilds, and redeploys.
11. Sailwind verifies `/health`.
12. The deployment reaches **LIVE**.

## Expected recovery evidence

The deployment log should contain evidence for:

- Missing `APP_SECRET`
- Diagnosis and confidence
- Proposed correction/diff
- Human approval
- Correction applied
- Redeployment
- HTTP health verification
- Final `LIVE` status

## Resetting the demo

Each deployment receives its own image/container tag. If an old demo container remains, Sailwind's Docker runner removes the previous container with the same deterministic name before starting a retry.

## Validation

Before submission:

```bash
pnpm typecheck
pnpm build
```

Record real demo measurements for:

- Time to deployment plan
- Time from failure to diagnosis
- Manual approval/intervention count
- Time from failure to verified LIVE
