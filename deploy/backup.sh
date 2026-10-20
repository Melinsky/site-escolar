#!/bin/sh
set -eu
umask 077
cd "$(dirname "$0")/.."
compose() { docker compose --env-file .env.production "$@"; }
stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
destination="deploy/backups/$stamp"
mkdir -p "$destination"
compose exec -T db pg_dump -U eeafr_owner -d eeafr_database -Fc > "$destination/database.dump"
compose run --rm --no-deps maintenance sh -ec "mkdir -p /backups/$stamp/uploads; if [ -d /data/uploads ]; then cp -a /data/uploads/. /backups/$stamp/uploads/; fi"
compose exec -T db pg_restore --list < "$destination/database.dump" > "$destination/contents.txt"
echo "Backup concluído em $destination. Copie esse diretório também para fora do VPS."
