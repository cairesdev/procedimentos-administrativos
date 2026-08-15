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
psql procedimentos -f api/db/migrations/0008_admin_sistema.sql
psql procedimentos -f api/db/migrations/0009_contrato_sem_processo.sql
psql procedimentos -f api/db/migrations/0010_contrato_vigencia_aberta.sql

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

## Zerar a base

```bash
psql procedimentos -f api/db/reset.sql
```

Apaga todos os dados de todas as prefeituras e preserva apenas o administrador master
(`suporte@procedimentos.app` / `12345678`). A estrutura das tabelas permanece — não é preciso
rodar as migrations de novo. A partir daí, cadastre a primeira prefeitura por `/admin`.

## Administração do sistema

A migration `0008_admin_sistema.sql` cria a tabela própria da equipe do produto e um acesso
inicial: `suporte@procedimentos.app` / `12345678`, em `/admin/login`.

Pelo painel `/admin` dá para cadastrar prefeituras, ligar e desligar módulos, configurar timbre
dos documentos e criar o primeiro usuário ADMIN de cada prefeitura — o que antes só era possível
por SQL.

## Usuários de teste (um por nível)

```bash
psql procedimentos -f api/db/seed_niveis.sql
```

Cria a Secretaria Municipal de Saúde, os setores Protocolo Geral, Setor de Compras,
Controladoria Geral e Alimentação Escolar, o fluxo padrão (Protocolo → Compras → Controladoria)
e os usuários abaixo. Senha de todos: `12345678`.

| Usuário | Papel | Lotação | Alcance no painel |
| --- | --- | --- | --- |
| `admin.demo` | ADMIN | Compras + unidade | Tudo, inclusive usuários e fluxo |
| `gestor.demo` | GESTOR | Secretaria de Saúde | Cadastros e despacho; não cria usuário nem fluxo |
| `controladoria.demo` | CONTROLADORIA | Controladoria Geral | Parecer e auditoria |
| `compras.demo` | COMPRAS | Setor de Compras | Contratos, fornecedores e ordem de fornecimento |
| `protocolo.demo` | PROTOCOLO | Protocolo Geral | Despacho na fila do setor |
| `nutricao.demo` | NUTRICIONISTA | Alimentação Escolar | Leitura e solicitações |
| `servidor.demo` | SERVIDOR | Secretaria de Saúde | Leitura e solicitações da sua unidade |

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
