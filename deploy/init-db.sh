#!/bin/sh
set -eu
export EEAFR_APP_PASSWORD="$(cat /run/secrets/postgres_app_password)"
psql --username "$POSTGRES_USER" --dbname postgres --set ON_ERROR_STOP=1 <<'SQL'
\getenv app_password EEAFR_APP_PASSWORD
CREATE ROLE eeafr_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE DATABASE eeafr_database OWNER eeafr_app ENCODING 'UTF8' TEMPLATE template0;
SQL
unset EEAFR_APP_PASSWORD
