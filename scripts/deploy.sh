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

# ---- Rotação da chave do MinIO ---------------------------------------------
# Segredo que não muda nunca é segredo que, no dia em que vaza, vale para
# sempre. A chave do MinIO já esteve num arquivo versionado — não vai acontecer
# de novo, mas a defesa não pode depender disso.
#
# A conta é por **idade da chave**, não por deploy. Rotacionar a cada `git
# push` não protege mais: o que limita o estrago de um vazamento é o tempo até
# a próxima troca, e esse tempo é o mesmo se o intervalo for de trinta dias com
# um deploy ou com quarenta. O que muda é o risco — toda troca recria três
# serviços, e amarrar isso a cada atualização é multiplicar as ocasiões de algo
# dar errado por um ganho que não existe.
#
# No .env.prod: ROTACAO_MINIO_DIAS=0 troca a cada atualização; um valor
# negativo (-1) desliga. Ausente ou vazio vale 30 — o padrão é rotacionar, e
# quem quiser o contrário precisa dizer isso por escrito.
#
# JWT_SECRET e AUTH_SECRET **não** entram aqui de propósito: trocá-los derruba
# toda sessão aberta, e um servidor perderia o formulário pela metade a cada
# atualização. Eles se rotacionam à mão, fora do expediente — a seção 7 do
# docs/deploy-vps.md explica.
ROTACAO_DIAS=$(grep -E '^ROTACAO_MINIO_DIAS=' "$ENV_FILE" | cut -d= -f2- || echo "")
ROTACAO_DIAS=${ROTACAO_DIAS:-30}

if [ "$ROTACAO_DIAS" -ge 0 ] 2>/dev/null; then
  ULTIMA=$(grep -E '^MINIO_ROTACIONADO_EM=' "$ENV_FILE" | cut -d= -f2- || echo "")

  if [ -z "$ULTIMA" ]; then
    # Sem data é chave que nunca foi rotacionada — inclusive a que vazou.
    IDADE=99999
  else
    IDADE=$(( ( $(date '+%s') - $(date -d "$ULTIMA" '+%s') ) / 86400 ))
  fi

  if [ "$IDADE" -ge "$ROTACAO_DIAS" ]; then
    passo "Chave do MinIO com ${IDADE} dia(s) — rotacionando antes de atualizar"
    # Antes da imagem nova: assim, se a rotação falhar e voltar atrás, a
    # produção continua na versão que já estava funcionando.
    ./scripts/rotacionar-minio.sh || falhar "a rotação falhou e foi revertida; o deploy parou aqui"
  else
    echo
    echo "Chave do MinIO tem ${IDADE} dia(s); rotaciona com ${ROTACAO_DIAS}."
  fi
fi

# ---- Código novo -----------------------------------------------------------
#
# A VPS **consome** o repositório: ela não tem trabalho próprio, e o que estiver
# aqui e não no GitHub é acidente — um arquivo editado à mão para "testar uma
# coisa", um commit feito no servidor errado. `--ff-only` recusa quando os dois
# lados divergem, e faz bem: um merge automático aqui juntaria produção com
# história que ninguém revisou.
#
# Só que "fatal: Not possible to fast-forward" não diz o que fazer, e a saída
# tentadora — `git push --force` daqui — **apagaria do GitHub** o trabalho que
# está lá e não está nesta máquina. Então o script explica antes de abortar.
passo "Atualizando o repositório"
git fetch origin --quiet

SO_LA=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)
SO_AQUI=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo 0)

if [ "$SO_AQUI" != "0" ]; then
  vermelho "ERRO: esta cópia tem $SO_AQUI commit(s) que não estão no GitHub."
  echo
  echo "O GitHub tem $SO_LA commit(s) que faltam aqui. Os dois lados divergiram,"
  echo "e por isso o 'git pull' não passa."
  echo
  echo "O que há só nesta máquina:"
  git log origin/main..HEAD --oneline | sed 's/^/  /'
  echo
  vermelho "NÃO resolva com 'git push --force' daqui."
  echo "Isso apagaria do GitHub os $SO_LA commit(s) que esta máquina não tem."
  echo
  echo "Se o que está acima não interessa — o caso normal, porque a VPS só"
  echo "consome o repositório —, descarte e alinhe com o GitHub:"
  echo
  echo "  git reset --hard origin/main"
  echo "  ./scripts/deploy.sh $VERSAO"
  echo
  echo "'reset --hard' descarta alterações em arquivos versionados. O .env.prod,"
  echo "a pasta data/ e a backups/ estão fora do git e não são tocados."
  echo
  echo "Se algum daqueles commits importa, leve-o para a sua máquina antes:"
  echo "  git format-patch origin/main   # gera os .patch para aplicar lá"
  exit 1
fi

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
