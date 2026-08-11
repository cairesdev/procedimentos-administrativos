# Procedimentos Administrativos — contexto do projeto

Sistema multi-tenant de gestão de processos administrativos para prefeituras municipais.
Uma base de dados atende várias prefeituras. Módulos: **Processos** (licitação → contrato →
solicitação → tramitação, implementado), **Frotas**, **Patrimônio**, **Almoxarifado/Alimentação
Escolar** (levantados e modelados, não implementados).

## Leitura obrigatória antes de codar

1. `docs/decisoes.md` — todas as decisões de levantamento, consolidadas com o cliente. **Nenhuma
   pode ser alterada sem aval do usuário.** O método de trabalho deste projeto é: cada decisão é
   discutida e aprovada antes de virar código — não gere schema/código de features não discutidas.
2. `docs/roadmap.md` — o que está pronto e o que está pendente.
3. `docs/uml-entidades.mermaid` (+ `uml-frotas`, `uml-patrimonio`, `uml-almoxarifado`) — modelo de dados.
4. Skill `procedimentos-backend` — convenções de código (instalada no ambiente).

## Estrutura

```
api/               Express + TypeScript, Clean Architecture (implementado)
  db/migrations/   0001..0007 SQL puro, numeradas, aplicadas manualmente em ordem
  src/
    domain/        regras puras, sem I/O (ErroDeNegocio, CalculadoraValorItem)
    application/   casos de uso + ports (interfaces)
    infrastructure/db, storage — implementações Postgres (SQL puro) e MinIO
    interface/http/ rotas finas, middlewares, schemas Zod
    container.ts   composição manual de dependências
web/               Next.js (painel admin + rotas públicas) — VAZIO, não iniciado
docs/              decisões, roadmap, UML
```

## Comandos

```
cd api
npm install
npm run typecheck    # tsc --noEmit — rodar sempre antes de entregar
npm run dev          # tsx watch
npm run build
```

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
