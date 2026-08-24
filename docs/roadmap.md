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
4. **Documentos emitidos** — motor e modelos padrão prontos (fatias 1 e 2). Falta estender aos
   módulos de patrimônio, frotas e almoxarifado: como o motor é genérico, cada peça nova é um
   modelo global por migration, sem código.
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

## Paginação e rate-limit

**Paginação só onde a lista cresce sem teto.** Treze endpoints passaram a devolver
`{ itens, total, pagina, porPagina }`: processos (fila), solicitações, contratos, licitações,
atas, fornecedores, bens, entradas, transferências, baixas, viagens, manutenções e auditoria.
Query: `?pagina=2&porPagina=50`, padrão 25 e teto 100. Cadastro que cabe numa tela — unidade,
setor, usuário, categoria, local, veículo, motorista, itens de contrato/ata, abastecimento da
viagem — continua devolvendo array puro; paginar isso só atrapalharia quem consome.

O total sai por `COUNT(*) OVER()` na mesma query, não num segundo `SELECT`: uma ida ao banco e
total coerente com a página, mesmo sob escrita concorrente. Toda query paginada ganhou desempate
por `id` no `ORDER BY` — sem isso, linhas com a mesma data podem trocar de página entre uma
requisição e outra e sumir da navegação.

**Três armadilhas que a paginação criaria, resolvidas junto:**

- *Contadores da fila.* O alerta de "N processos atrasados" contava no cliente e passaria a contar
  só a página. Agora `GET /processos` devolve `atrasados`, `vencendo` e `limiarAlertaDias` por
  janela sobre a fila inteira. O limiar virou `domain/shared/Prazos.ts` e viaja na resposta — a
  segunda cópia do número no front era a mesma classe de bug do `papelBase`.
- *Aviso de transferências pendentes.* Passou a vir do `total` de uma consulta filtrada por
  `PENDENTE`, não da contagem da página.
- *Formulários de seleção.* Um `<select>` de contratos que mostra 25 de 300 esconde opção sem
  avisar. Os formulários usam `listAll*`, que percorre as páginas (`porPagina=100`, no máximo 20
  voltas) e devolve a lista inteira. Tela de listagem não usa isso — lá a página é o ponto.

`GET /fornecedores` tinha `LIMIT 50` fixo no SQL: o 51º fornecedor era invisível e ninguém
recebia aviso. Agora pagina de verdade, e a tela ganhou busca por razão social/CNPJ.

**Rate-limit em duas camadas** (`express-rate-limit`, contador em memória — basta para um processo
de API; com mais de uma réplica, cada uma conta a sua):

| Camada | Janela | Chave | Observação |
| --- | --- | --- | --- |
| `/auth/login` e `/admin/login` | 5/min | IP + identificador tentado | Só erro consome cota (`skipSuccessfulRequests`) |
| Demais rotas autenticadas | 300/min | `usuarioId` ou `adminId` | Aplicado **depois** do `authenticate` |

O teto geral vem depois da autenticação de propósito: a API só recebe conexão do container do
Next, então antes de saber quem é o usuário todo mundo cairia no mesmo balde e o primeiro a usar o
sistema com força travaria a prefeitura inteira. Pelo mesmo motivo o Next repassa o IP real em
`X-Client-IP` (de `cf-connecting-ip` / `x-forwarded-for`), e a API confia nesse cabeçalho —
o que só é seguro porque a porta 3333 **não** é publicada. Se um dia a API for exposta
diretamente, esse cabeçalho vira mentira do cliente e o limite por IP precisa mudar.

## Documentos emitidos — fatia 1 (motor)

Peças oficiais em qualquer módulo: modelo predefinido no banco, editável pela prefeitura, emitido
por botão, congelado na emissão e conferível por QR.

**Modelo.** `documento_modelo` guarda o padrão como linha com `orgao_id` nulo — o **modelo global**,
mantido pelo painel do produto. A prefeitura que edita ganha uma linha própria que vence sobre a
global; "restaurar padrão" é apagar essa linha. A resolução sai em uma consulta
(`DISTINCT ON (tipo) ... ORDER BY tipo, (orgao_id IS NULL)`): dois SELECTs abririam janela para o
modelo trocar entre a leitura e o uso. Índices únicos **parciais** garantem um global por tipo e um
da prefeitura por tipo.

**Marcadores.** Duas construções, de propósito: `{{contrato.numero}}` e blocos
`{{#itens}}…{{/itens}}` que repetem por item (com `{{indice}}` para numerar). Sem condicional, sem
expressão — modelo de peça oficial é preenchimento de lacuna. Cada tipo tem catálogo próprio
(`domain/documento/Catalogo.ts`), conferido **ao salvar**, para o erro aparecer para quem edita e
não para quem tenta imprimir. Marcador que o contexto não conhece **derruba a emissão**: documento
com lacuna em branco é pior que documento que não saiu.

**Corpo é HTML restrito**, necessário para as tabelas das ordens de serviço. Passa por lista de
permissão (`sanitize-html`) ao salvar **e** ao renderizar, e todo valor interpolado é escapado —
a peça aparece numa página pública, onde HTML editável viraria XSS.

**Retrato, não arquivo.** `documento_emitido` grava o corpo já interpolado, os dados que o geraram
e a autoria congelada em texto (o servidor muda de setor; a peça não). Editar o modelo depois não
reescreve o que já saiu. Nenhum PDF no storage.

**Conferência pública** em `/conferencia/{codigo}`, fora do proxy de sessão, com limite próprio de
20/min por IP — é a única porta para conteúdo de qualquer prefeitura. Código sorteado em alfabeto
sem caracteres ambíguos (`0/O`, `1/I/L`), único no produto inteiro, e a resposta é a mesma para
código malformado e inexistente. Cancelar não apaga: a peça segue conferível, marcada como sem
efeito — papel já entregue não pode ficar sem contraparte.

**Por extenso** (`domain/documento/PorExtenso.ts`): valor monetário e data como o legado imprime.
Arredonda em centavos antes de separar, senão `0.1 + 0.2` sairia como vinte e nove centavos. A data
é fixada em `America/Sao_Paulo` — em container rodando UTC, o documento viraria o dia às 21h.
Pequena diferença em relação ao legado: os grupos são separados por vírgula, conforme a norma
("dezoito mil, quatrocentos e um reais"), enquanto o sistema antigo escreve "e".

Duas permissões novas: `documents:issue` (emitir, para quem conduz o processo) e
`documents:template` (editar modelo, administração da prefeitura).

## Corrigido nesta rodada

- **`/administracao/*` nunca passou pelo proxy de sessão.** O matcher excluía o prefixo solto
  `admin`, que também casa `administracao`. As guardas de página seguravam, então não houve porta
  aberta — mas qualquer tela nova que esquecesse `requirePermission` ficaria pública. Cada exceção
  do matcher agora termina em `(?:/|$)`.

## Documentos emitidos — fatia 2 (modelos padrão)

Migration `0015` semeia os **sete tipos do catálogo** como modelos globais, decalcados dos PDFs do
legado: Termo de Autorização, Despacho, Despacho do Fiscal, Parecer, Relatório da Controladoria,
Ordem de Serviço/Fornecimento e Comprovante de Solicitação. `ON CONFLICT DO NOTHING` para que
rodar de novo não sobrescreva ajuste já feito pelo painel do produto.

O painel do produto ganhou **Modelos padrão** (`/admin/modelos`): é o que torna verdadeira a
promessa de que corrigir a redação é um `UPDATE` só. A prefeitura edita a versão dela em
Administração › Modelos de documento, com a lista de marcadores ao lado e "restaurar padrão".

**Verificação dos modelos semeados** — um harness lê a própria migration e, para cada corpo,
confere contra o catálogo do tipo, garante que o sanitizador não remove nada do que foi escrito,
renderiza com contexto completo e checa que não sobra marcador cru nem tabela sem repetição. A
Ordem de Fornecimento é renderizada com os dados reais do PDF de São Bernardo e comparada com o
valor por extenso esperado.

### Corrigido junto

- **`reset.sql` apagaria os modelos globais.** Ele trunca tudo menos `admin_sistema` e
  `schema_migrations` — e, como preserva `schema_migrations`, a migration `0015` não rodaria de
  novo. A base voltaria sem modelo nenhum e a emissão pararia sem erro visível até alguém tentar.
  (Nem adiantaria excluir `documento_modelo` da lista: `TRUNCATE ... CASCADE` em `orgao` alcança
  a tabela pela FK.) O reset agora copia os globais para uma tabela temporária e os devolve depois.
