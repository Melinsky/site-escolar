#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
compose() { docker compose --env-file .env.production "$@"; }
test -f deploy/import/database.dump || { echo 'Coloque o dump em deploy/import/database.dump.' >&2; exit 1; }
compose up -d db
attempt=0
until compose exec -T db pg_isready -h 127.0.0.1 -U eeafr_owner -d postgres >/dev/null 2>&1 && compose exec -T db psql -U eeafr_owner -d eeafr_database -tAc 'SELECT 1' >/dev/null 2>&1; do
 attempt=$((attempt+1)); [ "$attempt" -lt 30 ] || { echo 'PostgreSQL não ficou disponível.' >&2; exit 1; }; sleep 2
done
tables="$(compose exec -T db psql -U eeafr_owner -d eeafr_database -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public'")"
[ "$tables" = 0 ] || { echo 'Destino já contém tabelas. Restauração cancelada; nenhum dado foi apagado.' >&2; exit 1; }
compose stop app proxy
compose exec -T db pg_restore -U eeafr_owner -d eeafr_database --role=eeafr_app --no-owner --no-privileges --single-transaction --exit-on-error < deploy/import/database.dump
# Invalidate sessions copied from the local computer without changing passwords.
compose exec -T db psql -U eeafr_owner -d eeafr_database -v ON_ERROR_STOP=1 -c 'DELETE FROM sessoes;'
compose run --rm --no-deps maintenance sh -ec 'mkdir -p /data/uploads; if [ -d /import/uploads ]; then cp -a /import/uploads/. /data/uploads/; fi; chown -R 1000:1000 /data/uploads'
echo 'Banco e uploads importados. As contas do banco original foram preservadas. Execute docker compose --env-file .env.production up -d --build.'
