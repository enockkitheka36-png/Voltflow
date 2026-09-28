# Voltflow 11.8.1 -> 11.8.2 — one-shot Supabase security proof (Windows helper)
# Prereq: Docker Desktop (or Podman) installed and running, plus the Supabase CLI.
# Usage (from repo root):  ./scripts/run-supabase-security-proof.ps1
# Dummy data only. Never commits .env.local. Never prints secrets.

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host "Voltflow Supabase security proof — repo: $RepoRoot"

# Fail fast with a clear message if no container runtime is present.
$dockerOk = $false
try { docker info *> $null; if ($LASTEXITCODE -eq 0) { $dockerOk = $true } } catch {}
$podmanOk = $false
try { podman --version *> $null; if ($LASTEXITCODE -eq 0) { $podmanOk = $true } } catch {}
if (-not $dockerOk -and -not $podmanOk) {
  Write-Warning "No container runtime detected. Install Docker Desktop (or Podman) and start it, then re-run."
  Write-Warning "The proof will record BLOCKED_DOCKER_MISSING and will NOT claim security passed."
}

# The Node runner performs all checks/steps and writes the reports.
node "scripts/run-supabase-security-proof.mjs"
exit $LASTEXITCODE
