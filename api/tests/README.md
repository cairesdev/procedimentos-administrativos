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

## Por que os testes de estrutura existem

Três bugs desta base não seriam pegos por tipo nenhum: um enum de papel que
existia na API e não no web (`papelBase`), uma lista de módulos no painel do
produto que não acompanhou o `CHECK` do banco, e uma rota literal registrada
depois da paramétrica. São checagens baratas que leem o próprio código.
