#!/bin/sh
# pg_dump diário no horário configurado, com retenção por dias.
# Roda em laço em vez de cron para o log sair no `docker compose logs backup`.
set -eu

HORA_BACKUP="${HORA_BACKUP:-03}"
RETENCAO_DIAS="${RETENCAO_DIAS:-14}"
DESTINO=/backups

log() { echo "[backup $(date '+%Y-%m-%d %H:%M:%S')] $*"; }

executar() {
  arquivo="${DESTINO}/${PGDATABASE}-$(date '+%Y%m%d-%H%M%S').sql.gz"
  log "gerando ${arquivo}"

  # Escreve em .parcial e só renomeia no fim: um dump interrompido nunca
  # é confundido com backup bom.
  if pg_dump --no-owner --no-privileges | gzip -9 > "${arquivo}.parcial"; then
    mv "${arquivo}.parcial" "${arquivo}"
    log "pronto ($(du -h "${arquivo}" | cut -f1))"
  else
    rm -f "${arquivo}.parcial"
    log "FALHOU — nada foi gravado"
    return 1
  fi

  removidos=$(find "${DESTINO}" -name "${PGDATABASE}-*.sql.gz" -mtime "+${RETENCAO_DIAS}" -print -delete | wc -l)
  [ "${removidos}" -gt 0 ] && log "removidos ${removidos} backup(s) com mais de ${RETENCAO_DIAS} dias"
  return 0
}

log "ativo — dump diário às ${HORA_BACKUP}h, retenção de ${RETENCAO_DIAS} dias"

# Um dump na subida garante que o backup funciona antes de você precisar dele.
executar || log "backup inicial falhou; seguindo para o agendamento"

while true; do
  agora=$(date '+%H%M')
  if [ "${agora}" = "${HORA_BACKUP}00" ]; then
    executar || true
    sleep 61
  fi
  sleep 30
done
