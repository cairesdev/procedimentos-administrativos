#!/usr/bin/env bash
# Atualiza a produção para uma versão publicada no Docker Hub.
#
#   ./scripts/deploy.sh 1.1.0     versão fixa (recomendado)
#   ./scripts/deploy.sh main      última da branch main
#
# Faz, nesta ordem: confere o ambiente, tira backup do banco, traz o código
# novo (compose e migrations), baixa as imagens, sobe e espera ficar saudável.
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"

vermelho() { printf '\033[31m%s\033[0m\n' "$*"; }
verde()    { printf '\033[32m%s\033[0m\n' "$*"; }
passo()    { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

falhar() { vermelho "ERRO: $*"; exit 1; }

VERSAO="${1:-}"
[ -n "$VERSAO" ] || falhar "informe a versão. Ex.: ./scripts/deploy.sh 1.1.0"

# ---- Pré-checagens ---------------------------------------------------------
# Rodar da pasta errada foi o que já quebrou um deploy: sem os arquivos de
# configuração, o Docker cria diretórios vazios no lugar deles.
[ -f "$COMPOSE_FILE" ] || falhar "rode a partir da raiz do repositório (não achei $COMPOSE_FILE)"
[ -f "$ENV_FILE" ] || falhar "$ENV_FILE não existe. Copie de .env.prod.example e preencha."

for arquivo in docker/postgres/postgresql.conf docker/caddy/Caddyfile docker/backup/rodar.sh; do
  [ -f "$arquivo" ] || falhar "$arquivo faltando — o clone está incompleto?"
done

dc() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

REPO=$(grep -E '^IMAGE_REPO=' "$ENV_FILE" | cut -d= -f2- || echo "workcenterma/br-consultoria")
REPO=${REPO:-workcenterma/br-consultoria}

passo "Conferindo se as imagens da versão $VERSAO existem"
for servico in api web; do
  docker manifest inspect "${REPO}:${servico}-${VERSAO}" >/dev/null 2>&1 \
    || falhar "${REPO}:${servico}-${VERSAO} não existe no registry. O CI terminou?"
  echo "  ok ${servico}-${VERSAO}"
done

# ---- Backup antes de qualquer coisa ----------------------------------------
# Migration nova pode ser irreversível; sem backup daqui, o rollback é só torcer.
passo "Backup do banco antes de atualizar"
if dc ps --status running --services 2>/dev/null | grep -qx db; then
  mkdir -p backups
  ARQUIVO="backups/pre-deploy-${VERSAO}-$(date '+%Y%m%d-%H%M%S').sql.gz"
  dc exec -T db pg_dump --no-owner --no-privileges \
    -U "$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | cut -d= -f2-)" \
    "$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | cut -d= -f2- || echo procedimentos)" \
    | gzip -9 > "$ARQUIVO"
  verde "  $ARQUIVO ($(du -h "$ARQUIVO" | cut -f1))"
else
  echo "  banco não está de pé — primeira subida, nada a salvar"
fi

# ---- Código novo -----------------------------------------------------------
passo "Atualizando o repositório"
git pull --ff-only

passo "Apontando IMAGE_TAG para $VERSAO"
ANTERIOR=$(grep -E '^IMAGE_TAG=' "$ENV_FILE" | cut -d= -f2- || echo "")
sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=${VERSAO}|" "$ENV_FILE"
echo "  ${ANTERIOR:-<vazio>} -> ${VERSAO}"

# ---- Subir -----------------------------------------------------------------
passo "Baixando as imagens"
dc pull api web

passo "Subindo (as migrations pendentes rodam no start da API)"
dc up -d

passo "Esperando ficar saudável"
for tentativa in $(seq 1 30); do
  DOENTES=$(dc ps --format '{{.Service}} {{.Status}}' | grep -Ev 'healthy|Exit 0' || true)
  if [ -z "$DOENTES" ]; then
    verde "  tudo saudável"
    break
  fi
  if [ "$tentativa" -eq 30 ]; then
    vermelho "  ainda não subiu depois de 60s:"
    echo "$DOENTES"
    echo
    echo "Log da API:"
    dc logs --tail 40 api
    echo
    echo "Para voltar: sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=${ANTERIOR}|' $ENV_FILE && dc up -d"
    exit 1
  fi
  sleep 2
done

passo "Migrations aplicadas neste deploy"
dc logs --tail 40 api | grep -i "migrations" || echo "  nenhuma pendente"

passo "Situação final"
dc ps

verde ""
verde "Produção em $VERSAO."
echo "Se algo estiver errado, volte para a versão anterior:"
echo "  sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=${ANTERIOR}|' $ENV_FILE"
echo "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d"
echo
echo "Atenção: rollback de imagem NÃO desfaz migration. Se a versão nova mexeu"
echo "no schema de forma incompatível, o caminho é restaurar o backup acima."
