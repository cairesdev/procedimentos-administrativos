# Procedimentos Administrativos — contexto do projeto

Sistema multi-tenant de gestão de processos administrativos para prefeituras municipais.
Uma base de dados atende várias prefeituras. Módulos implementados:

- **Processos** — licitação → contrato → solicitação → tramitação, com relatórios e dossiê.
- **Protocolo Externo** — balcão, portal do cidadão e exigência (sistema próprio).
- **Almoxarifado/Alimentação Escolar** — duas fatias entregues: entrada com lote e validade,
  solicitação com reserva, liberação FEFO, recebimento com perda, consumo, devolução com aceite,
  transferência entre almoxarifados, ajuste, qualidade do lote, relatório de consumo (PNAE) e
  acesso por escola.
- **Checklist** — modelos (inclusive o roteiro global do PNTP), ciclo com prazo e anexo,
  conferência e link externo para o fornecedor.
- **Patrimônio** — duas fatias: locais, categorias, entrada em lote com tombamento sequencial,
  inventário, transferência com aceite e baixa formal. Fora de escopo até hoje: valor de
  aquisição, foto/QR no bem e termo de responsável.
- **Frotas** — duas fatias: veículos, motoristas, ciclo da viagem, manutenção, abastecimento,
  agenda semanal e relatório de uso.
- **Saúde** — 1ª fatia: a ficha do pronto atendimento, ponta a ponta (paciente com prontuário
  vitalício, atendimento, triagem, avaliação, exames, prescrição com horários da enfermagem,
  evolução, procedimento e saída), quatro papéis clínicos com separação estrita de atos,
  retificação em vez de edição, e leitura de prontuário na auditoria.
- **Programas de cuidado continuado** — genérico, com o TEA como primeiro programa: inscrição
  (diagnosticado ou em investigação), fila por terapia, sessões com falta registrada, equipe com
  carga horária/local/vínculo, e o relatório oficial que responde a requisição do Ministério
  Público. Dois papéis: coordenação e terapeuta. Nada derivado é guardado — idade, dias de espera
  e exclusividade são conta na hora, no domínio.

## Leitura obrigatória antes de codar

1. `docs/decisoes.md` — todas as decisões de levantamento, consolidadas com o cliente. **Nenhuma
   pode ser alterada sem aval do usuário.** O método de trabalho deste projeto é: cada decisão é
   discutida e aprovada antes de virar código — não gere schema/código de features não discutidas.
2. `docs/roadmap.md` — o que está pronto e o que está pendente.
3. `docs/deploy-vps.md` — roteiro de produção.
4. `docs/uml-entidades.mermaid` (+ `uml-frotas`, `uml-patrimonio`, `uml-almoxarifado`) — modelo de dados.
4. Skill `procedimentos-backend` — convenções de código (instalada no ambiente).

## Estrutura

```
api/               Express + TypeScript, Clean Architecture (implementado)
  db/migrations/   0001..0012 SQL puro, numeradas; `npm run migrate` aplica as pendentes
  scripts/         migrate, bootstrap-admin, smoke
  Dockerfile       multi-stage → workcenterma/br-consultoria:api-*
  tests/           node --test: dominio/, aplicacao/ (com repositórios falsos)
                   e estrutura/ (SQL, rotas, contrato com o web)
  src/
    domain/        regras puras, sem I/O (ErroDeNegocio, CalculadoraValorItem)
    application/   casos de uso + ports (interfaces)
    infrastructure/db, storage — implementações Postgres (SQL puro) e MinIO
    interface/http/ rotas finas, middlewares, schemas Zod
    container.ts   composição manual de dependências
web/               Next.js — hub + /processos, /patrimonio, /frotas, /saude, /administracao, /admin
                   /saude: visão do dia + /atendimentos, /pacientes, /programas, /cadastros
  Dockerfile       Next standalone → workcenterma/br-consultoria:web-*
docs/              decisões, roadmap, UML
docker-compose.yml Postgres 18 + MinIO + api + web; dados em ./data (bind mount)
docker-compose.prod.yml  VPS: Caddy + HTTPS, nada exposto além do 443, backup diário
docker/postgres/   postgresql.conf — PGDATA versionado, ICU pt-BR, tuning de dev
.github/workflows/ CI: typecheck/lint em PR, push das imagens em main e tag v*
```

## Comandos

```
cd api
npm install
npm run typecheck    # tsc --noEmit (src, scripts e tests) — rodar sempre antes de entregar
npm test             # node --test + tsx; sem banco e sem rede
npm run migrate      # migrations pendentes (tabela schema_migrations)
python3 db/verificar-migrations.py   # antes de subir migration nova: aplica todas num
                                     # Postgres descartável e confere os CHECKs de verdade
                                     # (pip install --break-system-packages pgserver)
npm run dev          # tsx watch
npm run build
python3 db/palco-saude.py            # a ficha hospitalar inteira por HTTP, com cinco papéis
python3 db/palco-programa.py         # do catálogo ao ofício do MP, com cinco papéis

# ou tudo de uma vez:
cp .env.example .env && docker compose up --build
```

Nome do produto: `APP_NAME`/`APP_SHORT_NAME` no `.env` da raiz viram `NEXT_PUBLIC_APP_*` no build
do web (`web/src/shared/config/app.ts`). Entram no bundle — trocar exige rebuild da imagem.

Postgres: aplicar `db/migrations/*.sql` em ordem. `.env` a partir de `.env.example`
(DATABASE_URL, JWT_SECRET, PORT + MINIO_* com defaults dev).

## A regra que não pode ser quebrada

Cada prefeitura é um tenant (`orgao`). Banco único: **toda** query de leitura/escrita filtra por
`orgao_id` — nunca só pelo id do registro. Tabelas filhas alcançam o órgão por join na tabela pai.
Um `WHERE id = $1` solitário é vazamento entre prefeituras. Exceção deliberada: `fornecedor` e
`fornecedor_historico` são cadastro GLOBAL (sem orgao_id), compartilhado entre prefeituras, com
histórico obrigatório em toda alteração.

## Estilo de trabalho com o usuário (João)

- Responder em português, ultra-conciso, sem cortesias, código direto; se faltar dado, perguntar
  em uma linha.
- Decisões estruturais passam por ele antes de implementar (usar perguntas objetivas com opções).
- Levantamento de novos módulos segue o padrão: consolidar o que ele descreveu → perguntas em
  blocos → consolidar por escrito → só então modelar/codar.
