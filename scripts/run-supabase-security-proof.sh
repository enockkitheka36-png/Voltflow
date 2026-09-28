#!/usr/bin/env bash
# Voltflow 11.8.1 -> 11.8.2 — one-shot Supabase security proof (Linux/macOS helper)
# Prereq: Docker (or Podman) installed and running, plus the Supabase CLI.
# Usage (from repo root):  ./scripts/run-supabase-security-proof.sh
# Dummy data only. Never commits .env.local. Never prints secrets.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
echo "Voltflow Supabase security proof — repo: $REPO_ROOT"

if ! docker info >/dev/null 2>&1 && ! command -v podman >/dev/null 2>&1; then
  echo "WARNING: no container runtime detected. Install Docker (or Podman) and start it, then re-run." >&2
  echo "The proof will record BLOCKED_DOCKER_MISSING and will NOT claim security passed." >&2
fi

# The Node runner performs all checks/steps and writes the reports.
node "scripts/run-supabase-security-proof.mjs"
