#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker compose --env-file .env.production config --quiet
sh deploy/backup.sh
docker compose --env-file .env.production build --pull app
docker compose --env-file .env.production up -d --wait --wait-timeout 180
echo 'Atualização aplicada. Confira HTTPS, login e uploads conforme deploy/HOSTINGER.md.'
