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
| GET /patrimonio/transferencias, POST /bens/:id/transferir | pedido nasce PENDENTE; bem só muda de local no aceite; bloqueado por inventário aberto, transferência pendente ou bem baixado |
| POST /transferencias/:id/aceitar\|recusar | aceite move o bem e fecha na mesma transação; destino em inventário bloqueia |
| GET /patrimonio/baixas, POST /bens/:id/baixa | motivo obrigatório; bem vai a BAIXADO; sem estorno |

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
4. **Documentos emitidos** — o timbre já sai na impressão da solicitação; falta registrar o
   documento em `documento_emitido` com código verificador + QR e estender aos demais comprovantes.
5. **Testes automatizados** — só o smoke test do módulo Processos.
6. **Módulo Almoxarifado** — schema pronto, API não iniciada. Seguir levantamento em
   `docs/decisoes.md` + UML.
7. **Fila/worker (RabbitMQ)** — previsto na arquitetura, nenhum uso ainda.

## Infraestrutura

Imagens `workcenterma/br-consultoria:api-*` e `:web-*` (Dockerfiles multi-stage, Node 22 alpine,
usuário não-root). `docker-compose.yml` para teste local e `docker-compose.prod.yml` para VPS
(Caddy com HTTPS automático, Postgres 18 e MinIO sem porta pública, `pg_dump` diário com retenção).
Migrations aplicadas pelo entrypoint via `schema_migrations` + advisory lock. Roteiro completo em
`docs/deploy-vps.md`.

**Anexo agora desce em streaming pela API** — a URL pré-assinada do MinIO era inalcançável pelo
navegador (apontava para o host interno `minio`), então o download estava quebrado. Com isso o
MinIO deixou de precisar de domínio público.

## Bugs corrigidos nesta rodada

- **`papelBase: invalid enum value` ao cadastrar usuário.** O papel FROTAS entrou no banco
  (migration 0012) e no front, mas ficou de fora dos enums Zod da API, que repetiam a lista de
  papéis em dois lugares. A lista virou `domain/shared/Papeis.ts`, fonte única — o mesmo vale para
  os tipos de setor. Ao criar papel novo: incluir lá **e** na constraint via migration.
- **Tela de motoristas caía para quem tem papel FROTAS.** A página pedia `GET /usuarios`, que exige
  ADMIN/GESTOR, e o 403 derrubava a renderização inteira. Agora só busca quem tem `users:read`; o
  vínculo com usuário é opcional no motorista, então o campo simplesmente some.

## Configurações que não faziam nada (auditoria de coerência)

Levantamento do que a interface deixa configurar e nenhum código consome. Duas foram resolvidas:

| Configuração | Situação |
| --- | --- |
| Prazo por etapa | **resolvido** — calculado e sinalizado na fila e no detalhe |
| Trilha de auditoria | **resolvido** — tela em `/processos/auditoria` |
| Visibilidade estendida da etapa | gravada, nunca lida — nenhuma consulta usa |
| Timbre da prefeitura (`/admin`) | **resolvido** — imprime a solicitação com cabeçalho, logomarca e rodapé |
| Módulo ALMOXARIFADO no `/admin` | habilitável, sem nenhuma tela — o hub mostra o card travado |
| `usuario_permissao` (overrides) | decidido em `decisoes.md`, sem código; permissão é só papel base |

Sobra a visibilidade estendida e os overrides de permissão — enquanto nenhum código os ler, o
honesto é escondê-los do painel: melhor não oferecer do que oferecer sem efeito.

## Corrigido nesta rodada

- O filtro de bens oferecia o status **EM_AVERIGUACAO**, que o CHECK de `bem.status` não permite —
  filtrar por ele nunca casava nada. E a folha de inventário afirmava que bens não encontrados eram
  "marcados para averiguação", coisa que o código nunca fez. Os dois textos agora dizem a verdade.

## Dívidas conhecidas

- Usernames do backfill da migration 0007 são placeholders (`prefixo-email.4chars`).
- `listarFila` não filtra por departamento (só setor).
- Sem paginação nas listagens.
- Sem rate-limit/refresh-token no auth.
- Backup cobre só o banco; `./data/minio` (anexos) precisa de cópia à parte.
- Filtro de bens é `<form method="get">` (recarrega a página); sem paginação em nenhuma listagem.

## Solicitações, timbre e hub (rodada atual)

**Detalhe completo da solicitação.** `GET /solicitacoes` lista (filtros de situação e unidade) e
`GET /solicitacoes/:id` devolve o cabeçalho, cada item com o que veio do contrato (produto, marca,
modo de medição, valor unitário, quantidade, valor calculado e o saldo de hoje) e os contratos de
origem com fornecedor, vigência e fiscal. `/processos/solicitacoes` passou a listar solicitações —
antes listava processos — e `/processos/solicitacoes/[id]` mostra tudo isso numa tela só.
Migration `0013` acrescentou `solicitacao.created_at` (retroativo pela abertura do processo), que
não existia: rascunho não tinha data nenhuma.

**Timbre em uso.** `/processos/solicitacoes/[id]/imprimir` renderiza o mesmo detalhe dentro da
folha timbrada da prefeitura, sem sidebar nem topbar, com `@media print` escondendo o botão.
A logomarca deixou de ser um nome de arquivo digitado à mão — o painel do produto agora **faz
upload de verdade** (`PUT /admin/orgaos/:id/timbre/logomarca`, PNG/JPEG/WEBP/SVG até 2 MB, guardado
no MinIO) e a imagem desce em streaming pela API (`GET /auth/timbre/logomarca` para o servidor da
prefeitura, `GET /admin/orgaos/:id/timbre/logomarca` para o painel). Trocar a logomarca apaga a
anterior do storage; salvar os textos preserva o arquivo.

**Hub sem buraco.** O lobby mostra todos os sistemas: os que o usuário não pode abrir aparecem
travados, com cadeado e o motivo (módulo não contratado ou perfil sem acesso), em vez de sumirem.
