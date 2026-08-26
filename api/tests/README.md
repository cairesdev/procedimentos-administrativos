# Testes

`npm test` roda tudo com o executor nativo do Node (`node --test`) e o `tsx`,
que o projeto já usa no `npm run dev`. Sem Jest, sem Vitest: menos dependência
para manter e nenhuma configuração além do `package.json`.

## O que cada pasta cobre

- `dominio/` — regras puras: por extenso, marcadores de documento, CPF/CNPJ.
  Rodam sem banco e sem rede.
- `aplicacao/` — casos de uso com repositórios falsos (`ajudantes/`). Cada teste
  que espera recusa **também confere que nada foi gravado** — regra que passa e
  grava pela metade é pior que regra que não existe.
- `estrutura/` — o que o typecheck não alcança: sintaxe e parâmetros do SQL,
  ordem das rotas do Express, e o contrato entre a API e o web (eventos de
  auditoria, lista de módulos, matriz de permissões, rotas públicas).

## Migration nova: rode o verificador antes de subir

`npm test` confere a **sintaxe** do SQL com um parser. Ele não sabe se
`DROP CONSTRAINT produto_orgao_id_nome_unidade_medida_key` acerta o nome que o
Postgres gerou, nem se um `CHECK` recusa o que você acha que ele recusa. Isso só
o Postgres responde — e responderia na VPS, no meio do deploy.

```bash
pip install --break-system-packages pgserver   # uma vez
python3 db/verificar-migrations.py
```

Aplica todas as migrations em sequência num Postgres descartável e submete o
schema a estados que ele **tem de recusar**: perda sem motivo, rascunho com data
de envio, saldo maior que o recebido, entrega processada duas vezes. Fica fora
do `npm test` porque exige um banco, e a suíte do Node roda sem banco e sem rede
de propósito. O `pgserver` baixa um Postgres próprio e roda como usuário comum —
sem root e sem Docker.

## Por que os testes de estrutura existem

Três bugs desta base não seriam pegos por tipo nenhum: um enum de papel que
existia na API e não no web (`papelBase`), uma lista de módulos no painel do
produto que não acompanhou o `CHECK` do banco, e uma rota literal registrada
depois da paramétrica. São checagens baratas que leem o próprio código.
