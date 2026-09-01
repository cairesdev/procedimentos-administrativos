#!/usr/bin/env bash
# Troca o par de chaves do MinIO em produção, com prova e volta automática.
#
#   ./scripts/rotacionar-minio.sh          rotaciona agora
#   ./scripts/rotacionar-minio.sh --seco   mostra o que faria, sem mexer em nada
#
# A chave do MinIO é credencial de acesso, **não** chave de criptografia: os
# objetos em ./data/minio continuam legíveis depois da troca, e nenhum anexo se
# perde. Na prática é um restart com variável nova.
#
# Mesmo assim este script prova antes de dar por feito. A afirmação "trocar a
# credencial root do MinIO é só reiniciar" é verdadeira na versão que usamos,
# mas é uma afirmação sobre software de terceiro — e produção não é lugar de
# descobrir que ela mudou. Se a chave nova não conseguir listar o bucket, o
# script devolve o .env.prod anterior e sobe os serviços de volta sozinho.
#
# Os valores gerados nunca saem da VPS: são criados aqui, escritos no
# .env.prod (que é 600 e está fora do git) e não vão para stdout.
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"

vermelho() { printf '\033[31m%s\033[0m\n' "$*"; }
amarelo()  { printf '\033[33m%s\033[0m\n' "$*"; }
verde()    { printf '\033[32m%s\033[0m\n' "$*"; }
passo()    { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

falhar() { vermelho "ERRO: $*"; exit 1; }

SECO=0
[ "${1:-}" = "--seco" ] && SECO=1

[ -f "$COMPOSE_FILE" ] || falhar "rode a partir da raiz do repositório (não achei $COMPOSE_FILE)"
[ -f "$ENV_FILE" ] || falhar "$ENV_FILE não existe"
command -v openssl >/dev/null || falhar "openssl não encontrado"

dc() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

valor_de() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }

BUCKET=$(valor_de MINIO_BUCKET); BUCKET=${BUCKET:-procedimentos}

# ---- Chaves novas ----------------------------------------------------------
# O MinIO exige usuário com 3+ e senha com 8+ caracteres. `base64` produziria
# `+` e `/`, que o Compose lê sem problema mas confundem quem edita o arquivo à
# mão depois; hex é feio e inequívoco.
NOVA_ACCESS="k$(openssl rand -hex 10)"
NOVA_SECRET="$(openssl rand -hex 32)"

if [ "$SECO" = "1" ]; then
  passo "Ensaio — nada será alterado"
  echo "  MINIO_ACCESS_KEY passaria a ter ${#NOVA_ACCESS} caracteres"
  echo "  MINIO_SECRET_KEY passaria a ter ${#NOVA_SECRET} caracteres"
  echo "  serviços recriados: minio, minio-init, api"
  echo "  prova: mc ls sobre o bucket '$BUCKET' com a chave nova"
  exit 0
fi

# ---- De onde dá para voltar ------------------------------------------------
passo "Guardando o $ENV_FILE atual"
ANTERIOR="${ENV_FILE}.bak-$(date '+%Y%m%d-%H%M%S')"
cp "$ENV_FILE" "$ANTERIOR"
chmod 600 "$ANTERIOR"
echo "  $ANTERIOR"

voltar() {
  vermelho ""
  vermelho "A chave nova não passou na prova. Voltando para a anterior."
  cp "$ANTERIOR" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  dc up -d --force-recreate minio minio-init api >/dev/null 2>&1 || true
  vermelho "Revertido. O sistema está com a chave antiga, como estava antes."
  vermelho "Nada foi perdido — mas a chave vazada continua valendo."
  exit 1
}

# ---- Aplicar ---------------------------------------------------------------
# `sed` com | como separador: a chave hex não contém |, e / apareceria se um dia
# alguém trocasse a geração por base64.
passo "Escrevendo o par novo no $ENV_FILE"
sed -i "s|^MINIO_ACCESS_KEY=.*|MINIO_ACCESS_KEY=${NOVA_ACCESS}|" "$ENV_FILE"
sed -i "s|^MINIO_SECRET_KEY=.*|MINIO_SECRET_KEY=${NOVA_SECRET}|" "$ENV_FILE"
# Data da última troca: é ela que o deploy.sh consulta para saber se já passou
# da hora de rotacionar de novo.
if grep -qE '^MINIO_ROTACIONADO_EM=' "$ENV_FILE"; then
  sed -i "s|^MINIO_ROTACIONADO_EM=.*|MINIO_ROTACIONADO_EM=$(date '+%Y-%m-%d')|" "$ENV_FILE"
else
  printf '\n# Última rotação da chave do MinIO (scripts/rotacionar-minio.sh).\nMINIO_ROTACIONADO_EM=%s\n' \
    "$(date '+%Y-%m-%d')" >> "$ENV_FILE"
fi
chmod 600 "$ENV_FILE"

# A API lê a mesma variável: reiniciar só o minio a deixaria falando com a
# chave velha, e todo anexo passaria a dar erro de credencial.
passo "Recriando minio, minio-init e api"
dc up -d --force-recreate minio minio-init api || voltar

passo "Esperando o MinIO responder"
PRONTO=0
for _ in $(seq 1 30); do
  if dc ps --format '{{.Service}} {{.Status}}' | grep -q "^minio .*healthy"; then
    PRONTO=1
    break
  fi
  sleep 2
done
[ "$PRONTO" = "1" ] || voltar

# ---- A prova ---------------------------------------------------------------
# Listar o bucket com a chave nova, de dentro da rede do compose. Se o MinIO
# tivesse recusado a credencial nova, ele teria subido com a antiga e este
# comando falharia — que é exatamente o que se quer descobrir aqui, e não
# amanhã, quando alguém tentar abrir um anexo.
passo "Provando que a chave nova abre o bucket '$BUCKET'"
if dc run --rm --entrypoint sh minio-init -c \
     "mc alias set novo http://minio:9000 '$NOVA_ACCESS' '$NOVA_SECRET' >/dev/null && \
      mc ls novo/$BUCKET >/dev/null" 2>/dev/null; then
  verde "  a chave nova lê o bucket"
else
  voltar
fi

passo "Conferindo a API"
sleep 3
if dc logs --tail 40 api 2>/dev/null | grep -qiE "access denied|invalid.*credential|signature"; then
  vermelho "  a API reclamou de credencial no log"
  voltar
fi
verde "  sem erro de credencial no log da API"

# ---- Feito -----------------------------------------------------------------
verde ""
verde "Chave do MinIO rotacionada. A anterior não vale mais."
echo
echo "Falta o teste que nenhum script faz por você:"
echo "  abra um anexo antigo pelo sistema."
echo
echo "É o caso que importa — a API assina a URL com a chave nova sobre um"
echo "objeto que foi gravado com a antiga. Se o arquivo baixar, acabou:"
echo "  rm $ANTERIOR"
echo
amarelo "Enquanto não apagar, $ANTERIOR guarda a chave velha em texto puro."
