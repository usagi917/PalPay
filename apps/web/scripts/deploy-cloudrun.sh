#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1" >&2
    exit 1
  fi
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env var: ${name}" >&2
    exit 1
  fi
}

append_substitution() {
  local key="$1"
  local value="$2"
  SUBSTITUTIONS+=("${key}=${value}")
}

require_command gcloud
require_command git

export CLOUDSDK_CONFIG="${CLOUDSDK_CONFIG:-/tmp/gcloud-config}"

PROJECT_ID="${PROJECT_ID:-${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-wagyu-escrow}"
REPOSITORY="${REPOSITORY:-wagyu-repo}"
IMAGE_NAME="${IMAGE_NAME:-wagyu-escrow}"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "${APP_DIR}" rev-parse --short HEAD)}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Unable to resolve PROJECT_ID. Set PROJECT_ID or GCP_PROJECT_ID." >&2
  exit 1
fi

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)"
if [[ -z "${ACTIVE_ACCOUNT}" ]]; then
  echo "No active gcloud account found." >&2
  echo "Run: gcloud auth login" >&2
  echo "Then: gcloud auth application-default login" >&2
  exit 1
fi

require_env NEXT_PUBLIC_RPC_URL
require_env NEXT_PUBLIC_CHAIN_ID
require_env NEXT_PUBLIC_FACTORY_ADDRESS
require_env NEXT_PUBLIC_TOKEN_ADDRESS

GCP_LOCATION="${GCP_LOCATION:-us-central1}"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"
NEXT_PUBLIC_XMTP_ENV="${NEXT_PUBLIC_XMTP_ENV:-dev}"
CHAIN_ID="${CHAIN_ID:-${NEXT_PUBLIC_CHAIN_ID}}"

IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE_NAME}:${IMAGE_TAG}"

echo "Project      : ${PROJECT_ID}"
echo "Region       : ${REGION}"
echo "Service      : ${SERVICE_NAME}"
echo "Repository   : ${REPOSITORY}"
echo "Image URI    : ${IMAGE_URI}"

if ! gcloud artifacts repositories describe "${REPOSITORY}" \
  --project "${PROJECT_ID}" \
  --location "${REGION}" >/dev/null 2>&1; then
  echo "Creating Artifact Registry repository: ${REPOSITORY}"
  gcloud artifacts repositories create "${REPOSITORY}" \
    --project "${PROJECT_ID}" \
    --location "${REGION}" \
    --repository-format docker
fi

SUBSTITUTIONS=()
append_substitution "_IMAGE_URI" "${IMAGE_URI}"
append_substitution "_NEXT_PUBLIC_RPC_URL" "${NEXT_PUBLIC_RPC_URL}"
append_substitution "_NEXT_PUBLIC_CHAIN_ID" "${NEXT_PUBLIC_CHAIN_ID}"
append_substitution "_NEXT_PUBLIC_FACTORY_ADDRESS" "${NEXT_PUBLIC_FACTORY_ADDRESS}"
append_substitution "_NEXT_PUBLIC_TOKEN_ADDRESS" "${NEXT_PUBLIC_TOKEN_ADDRESS}"
append_substitution "_NEXT_PUBLIC_XMTP_ENV" "${NEXT_PUBLIC_XMTP_ENV}"
append_substitution "_CHAIN_ID" "${CHAIN_ID}"
append_substitution "_GCP_PROJECT_ID" "${PROJECT_ID}"
append_substitution "_GCP_LOCATION" "${GCP_LOCATION}"
append_substitution "_GEMINI_MODEL" "${GEMINI_MODEL}"
if [[ -n "${NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE:-}" ]]; then
  append_substitution "_NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE" "${NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE}"
fi

SUBSTITUTIONS_CSV="$(IFS=,; echo "${SUBSTITUTIONS[*]}")"

echo "Building image via Cloud Build..."
gcloud builds submit "${APP_DIR}" \
  --project "${PROJECT_ID}" \
  --config "${APP_DIR}/cloudbuild.yaml" \
  --substitutions "${SUBSTITUTIONS_CSV}"

ENV_VARS=(
  "NEXT_PUBLIC_RPC_URL=${NEXT_PUBLIC_RPC_URL}"
  "NEXT_PUBLIC_CHAIN_ID=${NEXT_PUBLIC_CHAIN_ID}"
  "NEXT_PUBLIC_FACTORY_ADDRESS=${NEXT_PUBLIC_FACTORY_ADDRESS}"
  "NEXT_PUBLIC_TOKEN_ADDRESS=${NEXT_PUBLIC_TOKEN_ADDRESS}"
  "NEXT_PUBLIC_XMTP_ENV=${NEXT_PUBLIC_XMTP_ENV}"
  "CHAIN_ID=${CHAIN_ID}"
  "GCP_PROJECT_ID=${PROJECT_ID}"
  "GCP_LOCATION=${GCP_LOCATION}"
  "GEMINI_MODEL=${GEMINI_MODEL}"
)
if [[ -n "${NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE:-}" ]]; then
  ENV_VARS+=("NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE=${NEXT_PUBLIC_BLOCK_EXPLORER_TX_BASE}")
fi
ENV_VARS_CSV="$(IFS=,; echo "${ENV_VARS[*]}")"

echo "Deploying Cloud Run service..."
gcloud run deploy "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --max-instances 1 \
  --image "${IMAGE_URI}" \
  --set-env-vars "${ENV_VARS_CSV}"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --format='value(status.url)')"

echo "Cloud Run URL: ${SERVICE_URL}"
