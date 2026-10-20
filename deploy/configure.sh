#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/workspace" -w /workspace node:22-alpine \
 node projeto-TCC/backend/scripts/configure-production.js "$@"
