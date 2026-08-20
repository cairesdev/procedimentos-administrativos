# Roadmap / estado do projeto

Atualizado: 2026-08-14.

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
| GET /admin/orgaos/:id/administradores, /promoviveis | painel do produto: quem é ADMIN da prefeitura e quem pode ser promovido |
| POST /admin/orgaos/:id/administrador, .../promover, .../senha; PATCH .../:usuarioId | criar, promover, redefinir senha e ativar/inativar; 422 ao inativar o último ativo; tudo auditado no órgão |

**Auditoria** — `auditoria_log` gravado dentro das transações dos use cases (contrato criado,
solicitação enviada/cancelada, processo despachado/movido, parecer, ordem, anexo adicionado/removido),
com autor, referência ao processo e detalhes em JSONB.

**Seed e smoke test** — `api/db/seed.sql` (prefeitura demo + módulo + admin) e `npm run smoke`
(`api/scripts/smoke.ts`): ~20 verificações do ciclo real, incluindo cancelamento, saldo
insuficiente, NF duplicada, papel e lotação inválidos.

**Painel web** — Next.js 16 em `web/`: login (NextAuth), navegação por etapa do processo,
cadastros com modal, wizard de contrato (origem licitação/ata → dados → itens → revisão),
importação de itens colando planilha, fila do setor, montagem de solicitação com saldo à vista,
despacho, parecer e ordem de fornecimento. Painel `/admin` para a equipe do produto: prefeituras,
módulos, timbre e primeiro administrador.

**API módulo Patrimônio** — `/patrimonio/*` (papel PATRIMONIO na migration 0011):

| Rota | Regra central |
| --- | --- |
| CRUD /patrimonio/locais | código só números, imutável após criar (prefixo do tombamento); exclusão travada por bens/inventários |
| CRUD /patrimonio/categorias | exclusão travada por bens |
| GET/POST /patrimonio/remessas | lote gera N bens; sequencial por local com UPSERT `contador + quantidade`; audita BENS_TOMBADOS |
| PATCH/DELETE /patrimonio/remessas/:id | edita só a nota; exclusão apaga os bens sem estornar o contador, travada por conferência (422); audita ENTRADA_PATRIMONIO_EXCLUIDA |
| GET /patrimonio/bens | filtros local e status |
| PATCH/DELETE /patrimonio/bens/:id | edita nome e categoria; exclusão travada por conferência; audita BEM_EXCLUIDO |
| GET/POST /patrimonio/inventarios | um aberto por local; lista montada dos bens ATIVOS do local |
| POST /:id/conferencias | upsert por (inventário, bem); `situacao` nula = ainda não conferido |
| POST /:id/concluir | audita INVENTARIO_CONCLUIDO |

**Web dividido em sistemas** — hub em `/` + `/processos`, `/patrimonio` e `/administracao`, cada um
com navegação e cor próprias (`shared/auth/modules.ts`, `shared/workspace/WorkspaceShell`).
Telas do patrimônio: locais, categorias, entradas (assistente origem → lotes → revisão, com prévia
do tombamento e cadastro de categoria sem sair do passo) e inventários (folha de conferência
paginada, marcação em lote sobre o filtro e conclusão travada enquanto houver bem não gravado).
Entradas e bens têm editar/excluir com o aviso de que o tombamento não volta.

**API módulo Frotas** — `/frotas/*` (papel FROTAS na migration 0012):

| Rota | Regra central |
| --- | --- |
| CRUD /frotas/veiculos | placa única por órgão, imutável na edição; exclusão travada por viagens |
| CRUD /frotas/motoristas | validade da CNH com contagem de dias; exclusão travada por viagens |
| GET/POST /frotas/viagens | valida veículo disponível, CNH válida e compartilhamento; devolve conflitos de agenda como aviso |
| POST /viagens/:id/aprovar\|recusar\|remarcar\|cancelar | máquina de estados explícita; 422 lista as transições possíveis |
| POST /viagens/:id/retirada | só de APROVADA; km ≥ hodômetro do veículo; nota de combustível opcional |
| POST /viagens/:id/finalizar | só de RETIRADA; km final ≥ km da retirada; grava km no veículo em transação |
| GET/POST /viagens/:id/abastecimentos, DELETE /abastecimentos/:id | só de viagem RETIRADA ou FINALIZADA; exige litros ou valor |
| GET /frotas/agenda?de=&ate= | uma linha por veículo, viagens da janela agrupadas; veículo sem viagem também vem |
| GET /frotas/relatorios/uso?de=&ate= | km, litros, combustível e manutenção por veículo, em subconsultas para não multiplicar somas |
| GET/POST /frotas/manutencoes | uma aberta por veículo; aberta bloqueia solicitação |
| POST /manutencoes/:id/encerrar | libera o veículo; data de fim ≥ início |

**Web sistema /frotas** — quarto workspace no hub (cor âmbar): agenda semanal, viagens, manutenções,
relatório de uso, veículos e motoristas. Ciclo da viagem operado na tela de detalhe, que só oferece
as ações que o estado aceita; abastecimentos lançados na mesma tela a partir da retirada.

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
6. **Patrimônio — 2ª fatia**: transferência entre locais com aceite do destino e baixa formal com
   motivo (modelados em `decisoes.md`, ainda sem API nem tela).
7. **Tela de auditoria** — API pronta (`GET /auditoria`), sem tela; link tirado do menu até existir.
8. **Testes automatizados** — só o smoke test do módulo Processos.
9. **Módulo Almoxarifado** — schema pronto, API não iniciada. Seguir levantamento em
   `docs/decisoes.md` + UML.
10. **Fila/worker (RabbitMQ)** — previsto na arquitetura, nenhum uso ainda.

## Infraestrutura

Imagens `workcenterma/br-consultoria:api-*` e `:web-*` (Dockerfiles multi-stage, Node 22 alpine,
usuário não-root). `docker-compose.yml` para teste local e `docker-compose.prod.yml` para VPS
(Caddy com HTTPS automático, Postgres 18 e MinIO sem porta pública, `pg_dump` diário com retenção).
Migrations aplicadas pelo entrypoint via `schema_migrations` + advisory lock. Roteiro completo em
`docs/deploy-vps.md`.

**Anexo agora desce em streaming pela API** — a URL pré-assinada do MinIO era inalcançável pelo
navegador (apontava para o host interno `minio`), então o download estava quebrado. Com isso o
MinIO deixou de precisar de domínio público.

## Dívidas conhecidas

- Usernames do backfill da migration 0007 são placeholders (`prefixo-email.4chars`).
- `listarFila` não filtra por departamento (só setor).
- Sem paginação nas listagens.
- Sem rate-limit/refresh-token no auth.
- Backup cobre só o banco; `./data/minio` (anexos) precisa de cópia à parte.
- Filtro de bens é `<form method="get">` (recarrega a página); sem paginação em nenhuma listagem.
