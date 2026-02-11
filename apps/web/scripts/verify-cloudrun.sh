#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-${CLOUD_RUN_URL:-}}"
if [[ -z "${BASE_URL}" ]]; then
  echo "Usage: $0 https://<service>.run.app" >&2
  exit 1
fi

BASE_URL="${BASE_URL%/}"

check_status() {
  local path="$1"
  local expected="$2"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")"
  if [[ "${code}" != "${expected}" ]]; then
    echo "FAIL ${path} expected ${expected}, got ${code}" >&2
    exit 1
  fi
  echo "OK   ${path} (${code})"
}

echo "Verifying ${BASE_URL}"

check_status "/" "200"
check_status "/agent" "200"
check_status "/api/agent/nonce?sessionId=healthcheck_01" "200"

if [[ -n "${TEST_TOKEN_ID:-}" ]]; then
  check_status "/api/nft/${TEST_TOKEN_ID}" "200"
fi

echo "Verification completed."
