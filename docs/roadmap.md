# Roadmap / estado do projeto

Atualizado: 2026-08-11 (handoff para novo agente).

## Pronto

**Banco** — migrations 0001–0007 (65+ tabelas, 4 módulos + núcleo), aplicadas pelo usuário.
Verificação estática: FKs resolvem, ordem válida, isolamento por orgao confirmado.

**Documentação** — `docs/uml-*.mermaid` (4 diagramas ER), `docs/decisoes.md`, este roadmap.

**API módulo Processos** (compila limpo, `npm run typecheck`):

| Rota | Regra central |
| --- | --- |
| POST /auth/login | identificador (email/username) + senha → JWT 8h |
| GET /auth/eu | perfil + lotações (front usa no seletor "atuando como") |
| CRUD /unidades, /setores(+departamentos) | ADMIN/GESTOR criam |
| POST/GET /usuarios | ADMIN cria; hash bcrypt; lotações validadas (1 destino cada) |
| CRUD /fornecedores | global; PATCH grava histórico; 409 documento duplicado |
| PUT/GET /fluxos/:tipoProcesso | ADMIN; substitui etapas em transação |
| POST/GET /licitacoes | 409 número duplicado |
| POST/GET /contratos, GET /:id/itens | nasce com processo+números; origem licitação/ata obrigatória; itens com saldo |
| POST /solicitacoes, PUT /:id/itens | rascunho sem reserva/números; multi-contrato |
| POST /solicitacoes/:id/enviar | FOR UPDATE, valida saldo, debita, gera números, cria processo, destino = 1ª etapa do fluxo ou override |
| POST /solicitacoes/:id/cancelar | devolve saldo, cancela processo |
| GET /processos(?setor=), GET /:id | fila e detalhe+timeline |
| POST /processos/:id/despachos | ANALISE/ENCAMINHAMENTO; destino = próxima etapa ou manual c/ override |
| POST /processos/:id/parecer | CONTROLADORIA/ADMIN; encerra; desfavorável devolve saldo |
| POST /processos/:id/ordens | COMPRAS/ADMIN; 1 por contrato; NF única por fornecedor |
| /processos/:id/anexos (POST/GET/download/DELETE) | MinIO, compensação, URL pré-assinada |
| GET /auditoria | ADMIN/GESTOR/CONTROLADORIA; filtros referência, tipo, período, paginação |

**Auditoria** — `auditoria_log` gravado dentro das transações dos use cases (contrato criado,
solicitação enviada/cancelada, processo despachado/movido, parecer, ordem, anexo adicionado/removido),
com autor, referência ao processo e detalhes em JSONB.

**Seed e smoke test** — `api/db/seed.sql` (prefeitura demo + módulo + admin) e `npm run smoke`
(`api/scripts/smoke.ts`): ~20 verificações do ciclo real, incluindo cancelamento, saldo
insuficiente, NF duplicada, papel e lotação inválidos.

## Pendente (ordem sugerida)

1. **Importação de planilha de itens** no cadastro de contrato/ata (mapeamento de colunas → campos
   extras).
2. **Link externo do fornecedor** — token de acesso para fornecedor completar cadastro/documentos
   sem login.
3. **Atendimento externo de balcão** — busca por número de protocolo, anexar como requerente,
   redespachar.
4. **Documentos emitidos** — comprovantes/declarações com timbre da prefeitura + QR do código
   (`documento_emitido`, `orgao_documento_config`).
5. **Prazos de etapa** — sinalizar processos vencidos na fila (prazo_dias/prazo_ativo já existem).
6. **Painel web** (`web/`, Next.js, vazio) — admin + rotas públicas no mesmo app (decisão tomada).
7. **Testes automatizados** — nada escrito ainda.
8. **Módulos Frotas, Patrimônio, Almoxarifado** — schema pronto, API não iniciada. Seguir
    levantamento em `docs/decisoes.md` + UML de cada um.
9. **Fila/worker (RabbitMQ)** — previsto na arquitetura, nenhum uso ainda.

## Dívidas conhecidas

- Usernames do backfill da migration 0007 são placeholders (`prefixo-email.4chars`).
- `listarFila` não filtra por departamento (só setor).
- Sem paginação nas listagens.
- Sem rate-limit/refresh-token no auth.
