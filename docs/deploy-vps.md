# Deploy na VPS

Roteiro do `docker-compose.prod.yml`. Requisitos: uma VPS com Docker Engine e o
plugin Compose, 2 GB de RAM (4 GB folgado), e um domínio que você controle.

## Arquitetura no ar

```
internet → :443 Caddy ─┬→ web   (Next, :3000)  ─→ api (Express, :3333)
                       │                            ├→ db    (Postgres 18)
                       └ (nada mais é publicado)     └→ minio (anexos)
```

Só o Caddy escuta na internet. O navegador nunca fala com a API Express direto:
o Next chama a API pela rede interna do Docker, e o que precisa sair do
navegador passa pela ponte autenticada em `/api/proxy`. Download de anexo desce
pela API em streaming — por isso o MinIO não precisa de domínio nem certificado.

## 1. DNS antes de tudo

Crie o registro A do domínio apontando para o IP da VPS e espere propagar. O
Caddy pede o certificado no primeiro `up` e o Let's Encrypt precisa alcançar a
porta 80 — sem DNS resolvendo, a emissão falha e o site sobe sem HTTPS.

```bash
dig +short procedimentos.suaprefeitura.gov.br   # tem que devolver o IP da VPS
```

Libere 80 e 443 no firewall. **Não** abra 5432 nem 9000.

## 2. Preparar a VPS

```bash
git clone <repositorio> /opt/procedimentos
cd /opt/procedimentos

cp .env.prod.example .env.prod
chmod 600 .env.prod
```

Preencha o `.env.prod`. Os segredos, um por vez:

```bash
openssl rand -base64 32   # JWT_SECRET
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 24   # POSTGRES_PASSWORD
openssl rand -base64 24   # MINIO_SECRET_KEY
```

`IMAGE_TAG` deve ser uma versão publicada (ex.: `1.0.0`). O compose recusa subir
se `DOMINIO`, `IMAGE_TAG` ou qualquer segredo obrigatório estiver vazio — é de
propósito, para não existir produção com senha em branco.

## 3. Subir

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f
```

Na primeira subida, nesta ordem: o Postgres roda o `initdb` (UTF8, collation ICU
pt-BR, checksums), o MinIO cria o bucket, a API aplica todas as migrations e
grava o administrador master, o Caddy emite o certificado.

Depois disso, entre em `https://SEU_DOMINIO/admin/login` com o `ADMIN_EMAIL` e
`ADMIN_SENHA` do `.env.prod`, cadastre a prefeitura, habilite os módulos e crie
o primeiro usuário ADMIN dela.

> A API reaplica `ADMIN_SENHA` a cada subida enquanto a variável existir. Depois
> de trocar a senha pelo painel, apague o valor do `.env.prod` — senão o próximo
> deploy volta a senha antiga.

## 4. Atualizar de versão

```bash
cd /opt/procedimentos
git pull                                    # traz compose e migrations novas
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=1.1.0/' .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

`pull_policy: always` busca a imagem nova, e o entrypoint aplica as migrations
pendentes antes de servir. Rollback é apontar o `IMAGE_TAG` de volta e subir de
novo — **desde que a migration nova não tenha mudado o schema de forma
incompatível**. Migration que remove coluna não tem volta por tag; nesse caso o
caminho é restaurar backup.

Para separar as etapas, ponha `RUN_MIGRATIONS=false` e rode à mão:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  run --rm api node dist/scripts/migrate.js
```

## 5. Backup

O serviço `backup` faz `pg_dump` comprimido em `./backups`, todo dia no horário
de `BACKUP_HORA`, guardando `BACKUP_RETENCAO_DIAS` dias. Ele também roda um dump
na subida, para você descobrir que o backup está quebrado antes de precisar dele.

```bash
ls -lh backups/
docker compose -f docker-compose.prod.yml --env-file .env.prod logs backup
```

Restaurar:

```bash
gunzip -c backups/procedimentos-20260819-030000.sql.gz | \
  docker compose -f docker-compose.prod.yml --env-file .env.prod \
  exec -T db psql -U procedimentos -d procedimentos
```

**O dump cobre só o banco.** Os anexos vivem em `./data/minio` e precisam de
cópia própria. E backup que nunca saiu da VPS não é backup — leve `./backups` e
`./data/minio` para fora, por rsync, rclone ou o snapshot do provedor.

## 6. Operação do dia a dia

```bash
# atalho para não repetir os parâmetros
alias dcp='docker compose -f docker-compose.prod.yml --env-file .env.prod'

dcp ps                      # o que está de pé
dcp logs -f api             # log da API
dcp restart web             # reinicia um serviço
dcp exec db psql -U procedimentos procedimentos   # console do banco
```

Console do MinIO não é publicado. Para abrir, faça um túnel da sua máquina:

```bash
ssh -L 9001:localhost:9001 usuario@vps
# depois: http://localhost:9001
```

## 7. Checklist de segurança

- [ ] `.env.prod` com `chmod 600` e fora do git
- [ ] Firewall liberando só 22, 80 e 443
- [ ] `ADMIN_SENHA` removida do `.env.prod` depois do primeiro login
- [ ] Backups sendo copiados para fora da VPS
- [ ] Restauração testada pelo menos uma vez em ambiente separado
- [ ] Segredos do Docker Hub (`DOCKERHUB_TOKEN`) com escopo de leitura/escrita
      só neste repositório

## Nota sobre os dados

`./data/postgres`, `./data/minio` e `./data/caddy` são bind mounts: `docker
compose down -v` **não** apaga. Para zerar de verdade é preciso remover a pasta
à mão — o que também significa que um `rm -rf data/` distraído leva o sistema
inteiro junto.
