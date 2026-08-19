#!/bin/sh
set -e

# Migrations e admin master ficam atrás de flags: em produção o normal é
# aplicar por fora, num job. Em docker-compose de teste, RUN_MIGRATIONS=true
# faz o `up` entregar um sistema já utilizável.
if [ "${RUN_MIGRATIONS}" = "true" ]; then
  node dist/scripts/migrate.js
  node dist/scripts/bootstrap-admin.js
fi

exec "$@"
