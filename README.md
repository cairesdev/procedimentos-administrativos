# Procedimentos Administrativos

Sistema multi-tenant de gestão de processos administrativos para prefeituras municipais.
Módulo implementado: **Processos** (licitação → contrato → solicitação → tramitação → parecer/ordem
→ anexos). Módulos modelados: Frotas, Patrimônio, Almoxarifado/Alimentação Escolar.

Contexto completo para agentes/devs: `CLAUDE.md`, `docs/decisoes.md`, `docs/roadmap.md`,
`docs/uml-*.mermaid`.

## Rodar com Docker (caminho recomendado para teste)

```bash
cp .env.example .env
# preencha JWT_SECRET, AUTH_SECRET e ADMIN_SENHA — o compose recusa vazios
# openssl rand -base64 32

docker compose up --build
```

Sobe Postgres 18, MinIO (com o bucket criado), API em `localhost:8004` e web em `localhost:3000`.
Console do MinIO em `localhost:9001`.
Com `RUN_MIGRATIONS=true` o container da API aplica as migrations pendentes e cria/atualiza o
administrador master a partir de `ADMIN_EMAIL`/`ADMIN_SENHA` — entre em `/admin/login` e cadastre
a primeira prefeitura.

O controle de migrations vive na tabela `schema_migrations`: cada arquivo roda uma vez, dentro de
uma transação, protegido por advisory lock (duas réplicas subindo juntas não colidem).

### Onde os dados ficam

| Serviço | Pasta no host | Observação |
| --- | --- | --- |
| Postgres | `./data/postgres` | montada em `/var/lib/postgresql` |
| MinIO | `./data/minio` | anexos |

São bind mounts, não volumes do Docker: `docker compose down -v` **não** apaga nada. Para zerar de
verdade, pare os containers e apague a pasta. Backup é cópia de arquivo — com o banco parado, ou
via `pg_dump` com ele no ar:

```bash
docker compose exec db pg_dump -U postgres procedimentos > backup.sql
```

### Postgres 18: duas armadilhas

1. **PGDATA mudou de lugar.** No 18 é `/var/lib/postgresql/18/docker` e o `VOLUME` declarado virou
   `/var/lib/postgresql`. Montar em `/var/lib/postgresql/data`, como se fazia até o 17, faz o banco
   gravar num volume anônimo e **perder tudo** quando o container é recriado. O compose já monta no
   lugar certo.
2. **`config_file` fora do PGDATA muda onde o `pg_hba.conf` é procurado.** Por isso
   `docker/postgres/postgresql.conf` traz `data_directory`, `hba_file` e `ident_file` explícitos.
   Ao subir para o PG19, troque o `18` nesses três caminhos **e** no `PGDATA` do compose.

O banco nasce com collation ICU `pt-BR` (ORDER BY respeita acento e cedilha), encoding UTF8,
checksums de página e fuso `America/Sao_Paulo`. Isso vale **só no primeiro `up`**: trocar collation
depois exige recriar o banco. Ajustes de memória, WAL e log ficam em
`docker/postgres/postgresql.conf` — os números são para máquina de desenvolvimento.

### Imagens

Um repositório, um prefixo por serviço:

| Tag | Conteúdo |
| --- | --- |
| `workcenterma/br-consultoria:api-<versao>` | API Express compilada, Node 22 alpine, usuário não-root |
| `workcenterma/br-consultoria:web-<versao>` | Next standalone |

Build local sem compose:

```bash
docker build -t workcenterma/br-consultoria:api-local ./api
docker build -t workcenterma/br-consultoria:web-local \
  --build-arg NEXT_PUBLIC_APP_NAME="BR Consultoria" ./web
```

O build do web precisa de rede: `next/font/google` baixa a fonte Inter no build.

### Nome do aplicativo

`APP_NAME` e `APP_SHORT_NAME` no `.env` viram `NEXT_PUBLIC_APP_*` no build do web e aparecem no
título da aba, no login, no hub, na topbar e no rodapé de versão. Como entram no bundle, mudar
exige `docker compose build web` — reiniciar o container não basta. Sem definir, o default é
"Procedimentos administrativos". A versão do rodapé vem de `IMAGE_TAG` (compose) ou da tag/SHA
do commit (CI).

### Produção (VPS)

`docker-compose.prod.yml` + `docs/deploy-vps.md`. Consome as imagens do Docker Hub, põe o Caddy na
frente com HTTPS automático e não publica mais nada: Postgres, MinIO e a API Express só existem na
rede interna. Inclui `pg_dump` diário com retenção.

```bash
cp .env.prod.example .env.prod && chmod 600 .env.prod   # preencher
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

O download de anexo desce em streaming pela API — o MinIO fica privado, sem domínio nem
certificado próprio.

### CI

`.github/workflows/ci.yml`: PR roda typecheck (api e web) e lint; push na `main` publica
`api-main`/`web-main` e `api-<sha>`/`web-<sha>`; tag `v1.2.0` publica `1.2.0`, `1.2` e `latest`
com os mesmos prefixos. Segredos necessários no repositório: `DOCKERHUB_USERNAME`,
`DOCKERHUB_TOKEN`. Variáveis opcionais: `APP_NAME`, `APP_SHORT_NAME`.

## Subir o ambiente sem Docker

Requisitos: Node 20+, PostgreSQL 15+, MinIO (para anexos).

```bash
createdb procedimentos

cd api
cp .env.example .env   # ajustar DATABASE_URL e JWT_SECRET
npm install
npm run migrate           # aplica as migrations pendentes, em ordem
npm run bootstrap:admin   # cria o admin master a partir do .env
npm run dev               # porta 3333

cd ../web
cp .env.example .env      # ajustar API_URL e AUTH_SECRET
npm install
npm run dev               # porta 3000
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

Apaga todos os dados de todas as prefeituras e preserva `admin_sistema` e `schema_migrations`.
A estrutura das tabelas permanece — não é preciso rodar as migrations de novo. A partir daí,
cadastre a primeira prefeitura por `/admin`.

## Administração do sistema

A migration `0008_admin_sistema.sql` cria a tabela própria da equipe do produto. O acesso nasce de
`npm run bootstrap:admin` (ou do entrypoint do container), a partir de `ADMIN_EMAIL`/`ADMIN_SENHA`
— rodar de novo com senha diferente troca a senha. Login em `/admin/login`.

Pelo painel `/admin` dá para cadastrar prefeituras, ligar e desligar módulos, configurar timbre
dos documentos e criar o primeiro usuário ADMIN de cada prefeitura — o que antes só era possível
por SQL.

## Usuários de teste (um por nível)

> **Faltando no repositório.** `api/db/seed_niveis.sql` sumiu do disco e nunca foi commitado —
> precisa ser regerado. Enquanto isso, crie os usuários pelo painel `/admin` + tela de usuários.

Quando existia, criava a Secretaria Municipal de Saúde, os setores Protocolo Geral, Setor de Compras,
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
npm run dev              # tsx watch
npm run typecheck        # tsc --noEmit (src + scripts)
npm run build            # compila src e os scripts de boot para dist/
npm start                # roda dist/
npm run migrate          # aplica migrations pendentes
npm run bootstrap:admin  # cria/atualiza o admin master pelo .env
npm run smoke            # ciclo completo contra a API no ar
```
