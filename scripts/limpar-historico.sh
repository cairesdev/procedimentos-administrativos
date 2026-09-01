#!/usr/bin/env bash
# Apaga um segredo do histórico do git — de todos os commits, para sempre.
#
#   ./scripts/limpar-historico.sh
#
# ATENÇÃO, e isto não é formalidade:
#
# Reescrever o histórico troca o hash de **todos** os commits a partir do mais
# antigo afetado. O repositório remoto só aceita o resultado com `push --force`,
# e qualquer clone existente — inclusive o da VPS — passa a ser incompatível: um
# `git pull` lá vai falhar, e o caminho é clonar de novo.
#
# Este script prepara e confere. Ele NÃO empurra nada: o `push --force` é a
# parte irreversível, e quem aperta esse botão é você, depois de olhar o
# resultado.
#
# ORDEM IMPORTA. Limpar o histórico **não** invalida a chave: quem já clonou o
# repositório continua com o valor antigo em disco. Rotacione primeiro
# (scripts/rotacionar-minio.sh), limpe depois. Ao contrário, a janela em que a
# chave vazada ainda vale continua aberta e você só terá dificultado a leitura.
set -euo pipefail

vermelho() { printf '\033[31m%s\033[0m\n' "$*"; }
amarelo()  { printf '\033[33m%s\033[0m\n' "$*"; }
verde()    { printf '\033[32m%s\033[0m\n' "$*"; }
passo()    { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

falhar() { vermelho "ERRO: $*"; exit 1; }

[ -d .git ] || falhar "rode a partir da raiz do repositório"

# Os valores a remover saem do **próprio histórico**, e não de uma lista escrita
# aqui.
#
# Escrevê-los no script resolveria o problema de hoje e criaria o de amanhã:
# depois da limpeza, o segredo continuaria versionado — dentro da ferramenta
# feita para tirá-lo dali. Um arquivo que existe para apagar uma credencial não
# pode ser o último lugar onde ela sobrevive.
#
# O procurar-segredo.sh já sabe distinguir credencial de placeholder; aqui só
# extraímos o valor do que ele encontrar, e você confirma antes de qualquer
# coisa acontecer.
passo "Procurando o que remover"
#
# Os dois passos do recorte importam. O primeiro grep começa no **nome do
# campo**, o que descarta o `83253:` que a varredura imprime na frente da linha
# — sem isso, o `:` do número seria confundido com o separador e o "segredo"
# extraído viria a ser o próprio `MINIO_ACCESS_KEY`. O sed então corta até o
# primeiro separador, e não o último: valor em base64 termina em `=`, e um
# recorte guloso comeria justamente o fim da chave.
mapfile -t SEGREDOS < <(
  ./scripts/procurar-segredo.sh --historico 2>/dev/null \
    | grep -oE '[A-Z_]*(SECRET|_KEY|SENHA|PASSWORD|TOKEN)[A-Z_]*[[:space:]]*[:=][[:space:]]*"?[^"[:space:]]{16,}' \
    | sed -E 's/^[^:=]*[:=][[:space:]]*"?//' \
    | sort -u
)

if [ "${#SEGREDOS[@]}" -eq 0 ]; then
  verde "Nada com cara de credencial no histórico. Não há o que limpar."
  exit 0
fi

command -v git-filter-repo >/dev/null 2>&1 || falhar \
  "git-filter-repo não encontrado. Instale com:
    pipx install git-filter-repo
  ou:
    pip install --user git-filter-repo"

# O filter-repo recusa repositório com trabalho pendente, e com razão: ele
# reescreve tudo, e o que não estiver commitado não sobrevive à conferência.
if [ -n "$(git status --porcelain)" ]; then
  falhar "há alterações não commitadas. Commite ou guarde com 'git stash' antes."
fi

echo
echo "Encontrei ${#SEGREDOS[@]} valor(es) para remover de toda a história:"
for segredo in "${SEGREDOS[@]}"; do
  ocorrencias=$(git log --all --oneline -S "$segredo" | wc -l)
  echo "  ${segredo:0:8}… (${#segredo} caracteres) em $ocorrencias commit(s)"
done
echo
amarelo "Isto reescreve TODOS os commits e exige push --force depois."
read -r -p "Confirma? Digite 'sim' para continuar: " resposta
[ "$resposta" = "sim" ] || { echo "Cancelado. Nada foi alterado."; exit 0; }

passo "Cópia de segurança antes de tocar em qualquer coisa"
# Espelho: guarda refs, tags e o histórico inteiro como está agora. Se algo der
# errado, é daqui que o repositório volta.
ESPELHO="../$(basename "$PWD")-antes-da-limpeza-$(date '+%Y%m%d-%H%M%S').git"
git clone --mirror . "$ESPELHO" >/dev/null 2>&1
verde "  $ESPELHO"

passo "Reescrevendo"
# `--replace-text` troca o valor por ***REMOVED*** em toda a história, em vez de
# apagar o arquivo inteiro: o `.env.example` precisa continuar existindo nos
# commits antigos, senão o histórico passa a contar uma versão do projeto que
# nunca houve.
LISTA=$(mktemp)
for segredo in "${SEGREDOS[@]}"; do
  printf '%s==>***REMOVIDO***\n' "$segredo" >> "$LISTA"
done

git filter-repo --replace-text "$LISTA" --force
rm -f "$LISTA"

passo "Conferindo"
restou=0
for segredo in "${SEGREDOS[@]}"; do
  if git log --all -p 2>/dev/null | grep -q "$segredo"; then
    vermelho "  ainda encontrei ${segredo:0:8}…"
    restou=1
  else
    verde "  ${segredo:0:8}… não existe mais no histórico"
  fi
done
[ "$restou" = "0" ] || falhar "a limpeza não pegou tudo — o repositório está no espelho acima"

./scripts/procurar-segredo.sh --historico || true

# O filter-repo remove o remoto de propósito, para não haver push distraído.
passo "O que falta, e é com você"
cat <<'FIM'
1. Olhe o resultado antes de empurrar:

     git log --oneline | head
     git show d42b6a7:api/.env.example 2>/dev/null || echo "(hash antigo já não existe — esperado)"

2. Torne o repositório privado no GitHub, se ainda não for:

     Settings -> General -> Danger Zone -> Change repository visibility

3. Devolva o remoto e empurre a reescrita:

     git remote add origin https://github.com/cairesdev/procedimentos-administrativos.git
     git push --force --all origin
     git push --force --tags origin

4. Na VPS, o clone antigo ficou incompatível. Lá:

     cd /caminho/do/projeto
     cp .env.prod /tmp/env.prod.guardado     # NÃO está no git, e não pode se perder
     cd .. && mv projeto projeto-antigo
     git clone https://github.com/cairesdev/procedimentos-administrativos.git projeto
     cd projeto && cp /tmp/env.prod.guardado .env.prod && chmod 600 .env.prod
     mv ../projeto-antigo/data ./data          # os dados são bind mount, vão junto
     mv ../projeto-antigo/backups ./backups

   Só apague `projeto-antigo` depois que o sistema estiver de pé e você tiver
   aberto um anexo pelo navegador.
FIM

echo
amarelo "O espelho em $ESPELHO guarda o histórico antigo — com o segredo dentro."
amarelo "Apague-o depois que estiver tudo certo."
