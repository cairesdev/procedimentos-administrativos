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

### Se o DNS está na Cloudflare

O modo **SSL/TLS precisa ser _Full (strict)_**. Em *Flexible*, a Cloudflare
recebe HTTPS do navegador mas fala HTTP puro com a origem; o Caddy responde com
o redirect automático para HTTPS e o navegador entra em **laço infinito de
308**. O sintoma no log do Caddy é uma enxurrada de:

```
"proto":"HTTP/1.1"  "X-Forwarded-Proto":["https"]  ...  "status":308
```

Duas configurações que funcionam:

| Proxy | Modo SSL/TLS | Observação |
| --- | --- | --- |
| DNS only (cinza) | irrelevante | o Caddy termina o TLS; HTTP-01 emite direto |
| Proxied (laranja) | **Full (strict)** | exige certificado válido na origem — o Caddy já providencia |

Se o primeiro `up` acontecer com o proxy ligado, o desafio HTTP-01 do Let's
Encrypt pode falhar com 502 e o Caddy cai no emissor alternativo (ZeroSSL).
Funciona, mas se quiser Let's Encrypt, emita com o proxy desligado e só depois
ligue em *Full (strict)*.

Um registro **AAAA** apontando para um IPv6 que a VPS não atende também gera
502: a Cloudflare prefere IPv6 ao buscar a origem. Se `ip -6 addr show scope
global` não mostrar endereço na VPS, apague o AAAA.

### Se usa Cloudflare Tunnel

Outra montagem, e a mais segura: o `cloudflared` roda na VPS e a Cloudflare
alcança a aplicação pelo túnel — **nenhuma porta precisa ficar aberta na
internet**. Regra no painel do túnel:

```
gestaobr.com.br   *   ->   http://localhost
```

Aqui quem termina o TLS é a Cloudflare e o túnel entrega **HTTP puro** na
origem. O Caddy precisa parar de gerenciar HTTPS, senão responde 308 para
`https://` e o navegador entra em laço. No `.env.prod`:

```
CADDY_FILE=Caddyfile.tunnel
CADDY_BIND=127.0.0.1
```

`Caddyfile.tunnel` escuta em `:80` com `auto_https off`. Nesta montagem o modo
SSL/TLS do painel é irrelevante — não existe conexão da Cloudflare para um IP
público seu.

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

`IMAGE_TAG` deve ser uma versão **já publicada** no Docker Hub — confira em
`hub.docker.com/r/workcenterma/br-consultoria/tags`. Se ainda não existe tag de
versão, use `main`, que o CI publica a cada push. O compose recusa subir
se `DOMINIO`, `IMAGE_TAG` ou qualquer segredo obrigatório estiver vazio — é de
propósito, para não existir produção com senha em branco.

> **O nome do produto é compilado na imagem.** `APP_NAME`/`APP_SHORT_NAME` no
> `.env.prod` não mudam nada em runtime: quem os aplica é o build. Para a
> imagem do CI nascer com o nome certo, defina as *variables* do repositório no
> GitHub (Settings → Secrets and variables → Actions → Variables):
> `APP_NAME` e `APP_SHORT_NAME`. Sem isso a interface mostra o nome padrão.

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

### O ciclo completo

**1. Na sua máquina** — publicar a versão:

```bash
git push                       # CI publica api-main / web-main
git tag v1.1.0 && git push origin v1.1.0   # CI publica api-1.1.0 / web-1.1.0 / *-latest
```

Espere o workflow terminar. **Confira que os DOIS lados saíram** — já aconteceu
de o job do web falhar e sobrar `api-1.0.0` sem `web-1.0.0`.

**2. Na VPS** — um comando:

```bash
cd /opt/gestaobr
./scripts/deploy.sh 1.1.0
```

O script recusa rodar da pasta errada ou sem `.env.prod`, confere que as duas
imagens existem no registry antes de mexer em qualquer coisa, tira um `pg_dump`
para `backups/pre-deploy-*.sql.gz`, dá `git pull`, troca o `IMAGE_TAG`, baixa as
imagens, sobe e espera todo mundo ficar `healthy` — mostrando o log da API se
não ficar. No fim imprime o comando exato de rollback.

### Se preferir na mão

```bash
cd /opt/gestaobr
git pull                                    # traz compose e migrations novas
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=1.1.0/' .env.prod
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

`pull_policy: always` busca a imagem nova, e o entrypoint aplica as migrations
pendentes antes de servir.

### Rollback

Apontar o `IMAGE_TAG` de volta e subir de novo — **desde que a migration nova
não tenha mudado o schema de forma incompatível**. Migration que remove coluna
não tem volta por tag; nesse caso o caminho é restaurar o backup que o script
tirou antes de subir.

Para separar migration de deploy, ponha `RUN_MIGRATIONS=false` e rode à mão:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  run --rm api node dist/scripts/migrate.js
```

### Depois de um deploy que traz módulo novo

Módulo novo não aparece sozinho: entre em `/admin`, abra a prefeitura e
**habilite o módulo**. Sem isso o sistema fica invisível no hub, mesmo com o
código no ar. Papel novo (`FROTAS`, `PATRIMONIO`) também precisa ser atribuído
aos usuários que vão operar.

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

## 7. Rotacionar segredo vazado

### O que vazou, exatamente

O primeiro commit do repositório (`d42b6a7`, 11/08/2026) trouxe um
`api/.env.example` que era, na verdade, um `.env` de trabalho:

```
MINIO_ENDPOINT="bucket.administracaopublica.com.br"
MINIO_ACCESS_KEY="krp8HTx…"      # 20 caracteres, em texto puro
MINIO_SECRET_KEY="8sMbhnM…"      # 40 caracteres, em texto puro
```

(Os valores completos não são repetidos aqui de propósito. Estão no commit,
que é onde o `scripts/limpar-historico.sh` vai buscá-los — copiá-los para a
documentação seria reintroduzir no repositório justamente o que se quer tirar
dele.)

**Leia o endpoint.** Essa chave não é do MinIO que sobe no
`docker-compose.prod.yml` — é de um servidor de armazenamento **externo**, com
SSL e bucket próprio, provavelmente compartilhado com outros sistemas. Trocar
`MINIO_SECRET_KEY` no `.env.prod` desta VPS **não invalida essa credencial**:
são dois serviços diferentes, e a chave vazada abre o de fora.

Quem precisa revogá-la é o administrador de
`bucket.administracaopublica.com.br`. Enquanto isso não acontecer, ela vale —
está pública desde 11/08 num repositório aberto, e bots varrem o GitHub à
procura exatamente disso.

A ordem, então, é esta:

1. **Revogar a chave no servidor externo.** É o que fecha o buraco.
2. **Rotacionar a chave do MinIO local** (`./scripts/rotacionar-minio.sh`) — não
   porque ela vazou, mas porque a chave deste ambiente nunca foi trocada.
3. **Tornar o repositório privado** e **limpar o histórico**
   (`./scripts/limpar-historico.sh`) — apaga o valor do passado, mas só depois
   de 1 e 2: limpar o histórico não invalida nada, e quem já clonou continua
   com o valor em disco.

### MinIO local

A chave do MinIO é credencial de acesso, **não** chave de criptografia: trocá-la
não torna nada ilegível e nenhum anexo se perde. É um restart.

```bash
cd /caminho/do/projeto
./scripts/rotacionar-minio.sh --seco    # mostra o que faria
./scripts/rotacionar-minio.sh           # faz
```

O script gera o par na própria VPS, guarda o `.env.prod` anterior, recria
`minio`, `minio-init` e `api` juntos — a API lê a mesma variável e ficaria com a
chave velha se só o minio reiniciasse — e então **prova** que a chave nova
abre o bucket. Se a prova falhar, ele devolve o `.env.prod` anterior e sobe os
serviços de volta sozinho.

Sobra um teste que nenhum script faz por você: **abrir um anexo antigo pelo
sistema**. É o caso que importa — a API assina a URL com a chave nova sobre um
objeto gravado com a antiga. Se baixar, apague o `.env.prod.bak-*`, que guarda a
chave velha em texto puro.

Se o `minio-init` falhar com `Access Denied`, a senha nova tem menos de 8
caracteres ou o `.env.prod` ficou com aspas em volta do valor — o Compose as
trata como parte do texto.

### A rotação que acontece sozinha

`./scripts/deploy.sh` rotaciona a chave do MinIO quando ela passa de
`ROTACAO_MINIO_DIAS` (padrão 30, gravado no `.env.prod`). `0` troca a cada
atualização; `-1` desliga.

A conta é por **idade da chave**, e não por deploy, de propósito. O que limita o
estrago de um vazamento é o tempo até a próxima troca — e esse tempo é o mesmo
com um deploy no mês ou com quarenta. O que muda é o risco: cada troca recria
três serviços, e amarrar isso a toda atualização multiplica as ocasiões de algo
dar errado sem ganho correspondente.

A rotação roda **antes** de trocar a imagem. Se ela falhar e voltar atrás, o
deploy para ali, com a produção na versão que já estava funcionando.

### JWT_SECRET, AUTH_SECRET e POSTGRES_PASSWORD

Ficam fora da rotação automática, cada um por seu motivo:

- `JWT_SECRET` e `AUTH_SECRET` **derrubam todas as sessões abertas**. Rotacionar
  a cada deploy faria o servidor da prefeitura perder o formulário pela metade
  toda vez que uma versão subisse. Troque à mão, fora do expediente.
- `POSTGRES_PASSWORD` no `.env.prod` **não** troca a senha do banco já
  inicializado — a variável só é lida no `initdb`. É preciso alterar dentro do
  Postgres e só então subir com o valor novo:

  ```bash
  dcp exec db psql -U procedimentos -c "ALTER USER procedimentos PASSWORD 'nova';"
  nano .env.prod
  dcp up -d --force-recreate api backup
  ```

### Limpar o histórico do git

```bash
./scripts/limpar-historico.sh
```

Faz um clone espelho de segurança, troca o valor por `***REMOVIDO***` em toda a
história com `git filter-repo`, confere que sumiu e para. O `push --force` é a
parte irreversível e fica com você — o script imprime os comandos.

Reescrever o histórico troca o hash de todos os commits: **o clone da VPS fica
incompatível** e precisa ser refeito. O roteiro para isso, incluindo como
preservar `.env.prod`, `data/` e `backups/`, está na saída do script.

### Impedir a próxima vez

```bash
./scripts/procurar-segredo.sh              # o que está versionado
./scripts/procurar-segredo.sh --historico  # todo o passado
```

Roda no CI a cada push e pull request, e barra a publicação da imagem. Procura
valor com cara de credencial em campo com cara de segredo, ignorando
placeholders — `JWT_SECRET=troque-este-segredo` passa, trinta e dois caracteres
aleatórios não.

## 8. Checklist de segurança

- [ ] **Chave do MinIO externo revogada em `bucket.administracaopublica.com.br`**
      — é a que vazou, e a única que a rotação local NÃO resolve (seção 7)
- [ ] `.env.prod` com `chmod 600` e fora do git
- [ ] Chave do MinIO local rotacionada (`./scripts/rotacionar-minio.sh`)
- [ ] Anexo antigo aberto pelo sistema depois da rotação
- [ ] Repositório privado no GitHub
- [ ] Histórico limpo (`./scripts/limpar-historico.sh`) e clone da VPS refeito
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
