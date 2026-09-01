#!/usr/bin/env bash
# Procura credencial de verdade nos arquivos que estão no git.
#
#   ./scripts/procurar-segredo.sh              o que está versionado hoje
#   ./scripts/procurar-segredo.sh --historico  todo o histórico do repositório
#
# Existe porque já aconteceu: as chaves do MinIO entraram no `api/.env.example`
# e ficaram três semanas num repositório público. O arquivo de exemplo é
# justamente onde a guarda cai — ele "não é o .env de verdade", então parece
# inofensivo colar ali o valor que está funcionando para não perdê-lo.
#
# A regra é simples: em arquivo versionado, o lugar do valor é um espaço vazio
# ou um texto que ninguém confundiria com senha. `MINIO_SECRET_KEY=` e
# `JWT_SECRET=troque-este-segredo` passam. Trinta e dois caracteres aleatórios
# não passam.
set -uo pipefail

MODO="${1:-}"

vermelho() { printf '\033[31m%s\033[0m\n' "$*"; }
verde()    { printf '\033[32m%s\033[0m\n' "$*"; }

# Nomes que carregam segredo. `_KEY` pega MINIO_ACCESS_KEY e SECRET_KEY sem
# pegar `IMAGE_TAG` nem `PUBLIC_KEY_URL`.
CAMPOS='(SECRET|_KEY|SENHA|PASSWORD|TOKEN|API_KEY|ACCESS_KEY)'

# Valor com cara de credencial: 16+ caracteres seguidos sem espaço.
#
# O alfabeto é "qualquer coisa que não seja espaço" de propósito. Restringi-lo
# a [A-Za-z0-9+/=_-] parecia suficiente — cobre hex e base64 —, mas deixava
# passar senha de gerenciador, que vem cheia de pontuação: um `%` no quarto
# caractere quebrava a contagem e o segredo passava batido. Falso positivo
# aqui custa uma linha na lista de INOCENTES; falso negativo custa o que já
# custou uma vez.
SUSPEITO="^\+?[A-Z_]*${CAMPOS}[A-Z_]*[[:space:]]*[:=][[:space:]]*[\"']?[^[:space:]]{16,}"

# O que é placeholder e pode ficar. Tudo aqui é palavra que um humano escreveu
# para dizer "troque isto", ou valor padrão de imagem de desenvolvimento —
# `minioadmin` é o par que o MinIO cria sozinho e está em toda a documentação
# dele; se alguém usar isso em produção, o problema não é vazamento.
# `REMOVIDO` é a marca que o limpar-historico.sh deixa no lugar do valor:
# depois da limpeza, o histórico fica cheio de `SECRET_KEY="***REMOVIDO***"`,
# que é o oposto de um vazamento.
INOCENTES='troque|exemplo|example|placeholder|minioadmin|postgres|changeme|seu-|sua-|xxx|<|\$\{|process\.env|senha-forte|coloque|REMOVIDO'

achados=0

conferir() {
  local origem="$1" texto="$2"

  local linhas
  linhas=$(printf '%s' "$texto" | grep -nEi "$SUSPEITO" | grep -viE "$INOCENTES" || true)
  [ -z "$linhas" ] && return 0

  vermelho "  $origem"
  printf '%s\n' "$linhas" | sed 's/^/    /'
  achados=$((achados + 1))
}

if [ "$MODO" = "--historico" ]; then
  echo "Procurando em todo o histórico do git…"
  echo
  # `log -p` traz cada versão de cada arquivo que já existiu. É lento e é o
  # ponto: o vazamento mora no passado, não no topo.
  conferir "histórico" "$(git log --all -p 2>/dev/null | grep '^+' || true)"
else
  echo "Procurando nos arquivos versionados…"
  echo
  while IFS= read -r arquivo; do
    [ -f "$arquivo" ] || continue
    case "$arquivo" in
      *.png|*.jpg|*.jpeg|*.pdf|*.ico|*.woff*|*package-lock.json) continue ;;
      # Este script fala de segredo o tempo todo; procurar em si mesmo só
      # geraria alarme sobre as próprias expressões.
      scripts/procurar-segredo.sh) continue ;;
    esac
    conferir "$arquivo" "$(cat "$arquivo")"
  done < <(git ls-files)
fi

echo
if [ "$achados" -gt 0 ]; then
  vermelho "Parece haver credencial de verdade em $achados lugar(es)."
  echo
  echo "Se for mesmo credencial:"
  echo "  1. tire do arquivo e deixe o campo vazio;"
  echo "  2. **rotacione o valor** — tirar do arquivo não o invalida, e quem"
  echo "     clonou o repositório continua com ele;"
  echo "  3. se já foi para o GitHub, o passado também precisa de limpeza:"
  echo "     scripts/limpar-historico.sh"
  echo
  echo "Se for falso positivo, acrescente o termo à lista INOCENTES aqui."
  exit 1
fi

verde "Nada com cara de credencial."
