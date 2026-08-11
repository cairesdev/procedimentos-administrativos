# Procedimentos Administrativos

Sistema multi-tenant de gestão de processos administrativos para prefeituras municipais.
Módulo implementado: **Processos** (licitação → contrato → solicitação → tramitação → parecer/ordem
→ anexos). Módulos modelados: Frotas, Patrimônio, Almoxarifado/Alimentação Escolar.

Contexto completo para agentes/devs: `CLAUDE.md`, `docs/decisoes.md`, `docs/roadmap.md`,
`docs/uml-*.mermaid`.

## Subir o ambiente

Requisitos: Node 20+, PostgreSQL 15+, MinIO (para anexos).

```bash
# 1. Banco
createdb procedimentos
psql procedimentos -f api/db/migrations/0001_nucleo.sql
psql procedimentos -f api/db/migrations/0002_processos.sql
psql procedimentos -f api/db/migrations/0003_frotas.sql
psql procedimentos -f api/db/migrations/0004_patrimonio.sql
psql procedimentos -f api/db/migrations/0005_almoxarifado.sql
psql procedimentos -f api/db/migrations/0006_solicitacao_rascunho.sql
psql procedimentos -f api/db/migrations/0007_login_identificador.sql

# 2. MinIO (dev)
docker run -d -p 9000:9000 minio/minio server /data

# 3. API
cd api
cp .env.example .env   # ajustar DATABASE_URL e JWT_SECRET
npm install
npm run dev            # porta 3333
```

## Bootstrap do primeiro acesso

Criar usuário exige papel ADMIN — o primeiro admin de cada prefeitura nasce pelo seed:

```bash
psql procedimentos -f api/db/seed.sql
```

Cria a Prefeitura Demo, habilita o módulo PROCESSOS e o admin `admin.demo` / `12345678`.
Login: `POST /auth/login` `{ "identificador": "admin.demo", "senha": "12345678" }`.

## Smoke test

Com a API no ar e o seed aplicado:

```bash
npm run smoke
```

Percorre o ciclo real contra o banco: cadastros → fluxo → licitação → contrato → rascunho → envio
(reserva) → despachos → ordem → parecer, mais os cenários de cancelamento (devolve saldo), saldo
insuficiente, NF duplicada, papel e lotação inválidos. Cada execução usa sufixo próprio, então
pode rodar quantas vezes quiser.

## Scripts

```
npm run dev         # tsx watch
npm run typecheck   # tsc --noEmit
npm run build       # compila para dist/
npm start           # roda dist/
```
