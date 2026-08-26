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
3. **Protocolo externo** — 1ª fatia (balcão e consulta) entregue; faltam a abertura pelo cidadão
   e o ciclo de exigência/resposta.
4. **Documentos emitidos** — motor, modelos padrão e as peças de todos os módulos prontos
   (fatias 1 a 4).
5. **Testes automatizados** — suíte em `api/tests` (`npm test`), rodando no CI. Falta cobrir os
   casos de uso de patrimônio e frotas, e o smoke test do módulo Processos continua exigindo
   ambiente de pé.
6. **Módulo Almoxarifado** — fatias 1 e 2 entregues, API e web. Falta o relatório de consumo
   para o PNAE, que agora tem dado para existir.
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

## Rodada de interface

**Telas de detalhe.** Ata (`/processos/atas/[id]`) mostra itens registrados, a licitação de
origem e os contratos firmados a partir dela, com aviso quando a vigência venceu — ata vencida não
origina contrato novo, mas os já firmados seguem pela vigência própria.
Licitação (`/processos/licitacoes/[id]`) mostra as atas que ela gerou e
todos os contratos vinculados — inclusive os que vieram por ata dela, que antes não apareciam em
lugar nenhum. Contrato (`/processos/contratos/[id]`) traz itens com saldo, unidades destinadas,
fiscal e a origem, com o rastro completo quando veio de ata: ata → licitação que a gerou. O
detalhe da solicitação agora aparece dentro da tela do processo, para quem despacha ver o que foi
pedido sem sair dali, e os contratos dele linkam para contrato e licitação de origem.

**Montagem da solicitação em dois passos.** Escolhe a unidade, vê os contratos *dela*, e só então
abre os itens do contrato que interessa. A tela antiga carregava todos os contratos com todos os
itens de uma vez: numa prefeitura com dezenas de contratos, uma parede de produtos onde era fácil
pedir do contrato errado.

A regra por unidade passou a valer de verdade, nos dois lados:

- Quem tem lotação de **unidade** só solicita em nome dela. Quem é de **setor** (compras,
  protocolo) segue escolhendo qualquer unidade — é o trabalho deles atender várias.
- `GET /contratos/para-solicitacao` devolve só contrato vigente, com saldo e **destinado à
  unidade**. `contrato_unidade` existia desde a migration 0002 e nunca havia sido consultado: a
  dica na tela dizia "só aparecem contratos destinados à unidade escolhida" e isso era falso.
- `MontarRascunhoSolicitacao` recusa item de contrato fora da unidade e recusa pedido em nome de
  unidade onde o servidor não é lotado. A trava do navegador sozinha seria cosmética.

**Documento criado pelo administrador.** Migration `0016` separou `escopo` de `tipo`. O escopo diz
de onde a peça fala — processo, processo com contrato, ordem ou solicitação — e é ele que decide
os marcadores e a busca dos dados. O `tipo` virou só a identidade, incluindo peça inventada pela
prefeitura: o administrador escolhe o escopo, dá um nome, e o identificador sai do nome. Peça
criada assim é marcada como `personalizado` e oferece **excluir** em vez de "restaurar padrão" —
não há padrão atrás dela.

**Auditoria só para o ADMIN da prefeitura.** A trilha mostra o que cada servidor fez em todos os
módulos: é registro de conduta, não relatório operacional. GESTOR e CONTROLADORIA perderam o
acesso na matriz de permissões e na rota (`exigirPapel("ADMIN")`).

### Pego na verificação

- **Cópia do padrão herdava a marca de personalizada.** Quando a prefeitura editava um modelo
  global que o painel do produto havia criado, a linha nova saía com `personalizado: true` — e a
  tela passava a oferecer "excluir" no lugar de "restaurar padrão", sem caminho de volta ao texto
  de fábrica. A linha criada por personalização sempre tem um padrão atrás dela.

### Navegação entre licitação, ata e contrato

Fechado o triângulo: da licitação chega-se às atas e aos contratos (inclusive os que vieram por
ata dela); da ata, à licitação de origem e aos contratos gerados; do contrato, à ata e à licitação
que originou a ata. O detalhe da solicitação linka para o contrato e para a origem dele.

Uma verificação automática recusa link de detalhe que aponte para a listagem (exceto o "voltar"),
que era o remendo usado enquanto a tela de ata não existia.

## Módulo Protocolo Externo — 1ª fatia (balcão e consulta)

Porta de entrada para quem não é servidor. O núcleo já previa isto desde a migration 0001 —
`requerente`, `processo.requerente_id`, `tipo_processo = ATENDIMENTO_EXTERNO` e anexo enviado por
requerente existiam e nunca haviam sido usados.

**Assuntos configuráveis** (`assunto_protocolo`, migration 0017): cada prefeitura cadastra o que
atende e amarra o setor que resolve. O atendimento nasce direto no setor certo, sem triagem. Sem
setor no assunto, cai na primeira etapa do fluxo de atendimento externo; **sem nenhum dos dois a
abertura é recusada** — o processo nasceria sem fila e ficaria invisível em toda tela.

**Balcão** (`/processos/protocolo`): o atendente digita o documento primeiro, o sistema puxa o
cadastro de quem já foi atendido antes e o resto do formulário vem preenchido. Requerente é
reaproveitado pelo CPF/CNPJ — dois cadastros da mesma pessoa partiriam o histórico dela em dois.
Papel `PROTOCOLO` ganhou a permissão `protocol:serve`.

**Consulta pública** (`/protocolo`, fora do proxy de sessão): protocolo **mais** documento. O
número é sequencial e adivinhável por construção; sozinho, deixaria qualquer um ler o pedido
alheio. A resposta é a mesma para dado malformado, protocolo inexistente e documento que não
confere — distinguir os três entregaria de graça, a quem varre, qual protocolo existe. Limite de
20 consultas por minuto por IP, o mesmo da conferência de documento.

**A consulta mostra andamento, não os autos.** Situação, setor atual, datas, prazo do assunto e a
movimentação entre setores. Texto de despacho, parecer e anexo de servidor ficam de fora: são peças
de trabalho da administração. Uma verificação automática lê o SQL e recusa coluna interna na lista
de retorno das duas consultas públicas.

**Validação de CPF/CNPJ** (`domain/protocolo/Documento.ts`) existe menos por rigor cadastral e mais
porque o documento é metade da chave da consulta: documento errado no cadastro deixa o cidadão sem
conseguir acompanhar o próprio pedido, e ele não tem a quem recorrer além de voltar ao balcão.

Assunto com atendimento não pode ser excluído — desativar tira da lista sem apagar a classificação
dos processos antigos.

## Protocolo Externo — 2ª fatia (portal do cidadão)

Abertura de pedido sem login em `/protocolo/abrir/{cnpj}`.

**A prefeitura vem no endereço, e não existe listagem.** O portal é divulgado pela própria
prefeitura no site dela; publicar a lista de quem usa o sistema entregaria a carteira de clientes
do produto a qualquer visitante. O CNPJ serve de chave por ser público por natureza.

**Três freios, porque cada um cobre o furo do outro:**

| Freio | Onde | Por quê |
| --- | --- | --- |
| 3 aberturas/hora por IP | Rota pública | Cada pedido vira processo que alguém vai ter de ler |
| 5 aberturas/dia por documento | Caso de uso | Robô que troca de IP esbarra aqui; CPF válido não é barato de girar |
| Campo-armadilha escondido | Formulário e rota | Preenchedor automático cai nele; responde sucesso sem gravar, para não ensinar o autor a contornar |

O balcão **não** tem freio nenhum: há um servidor olhando quem está na frente dele, e travar o
atendimento presencial seria pior que o abuso que se evita.

**A resposta pública devolve só protocolo e número do processo** — nem o id interno. O assunto
listado no portal leva nome, descrição e prazo; setor responsável e contagem de atendimentos são
internos e ficam de fora. Uma verificação automática lê a rota e recusa campo interno na resposta.

A ponte `/api/publico/[cnpj]/pedidos` existe separada do `/api/proxy` porque aquela exige sessão —
e repassa o IP real, sem o qual todo o país cairia no mesmo balde do limite (o do container do Next).

## Protocolo Externo — 3ª fatia (exigência e resposta)

Pedido que chega incompleto tinha dois caminhos: indeferir ou telefonar. A exigência dá um
terceiro, e muda quem está devendo resposta — enquanto ela está pendente, o processo está parado
esperando o **cidadão**, não o setor.

**Uma exigência pendente por processo**, garantida por índice único parcial. Duas perguntas em
aberto deixariam o requerente sem saber a qual responde e o servidor sem saber qual foi respondida.

**O prazo é congelado na criação** (`prazo_limite`): mudar o padrão do assunto depois não pode
encurtar retroativamente o prazo de quem já foi notificado.

**O canal do requerente não tem sessão.** A credencial é o par protocolo + documento, conferido a
cada chamada — o mesmo que abre o acompanhamento. Sessão para o cidadão traria expiração,
recuperação de acesso e suporte por causa de duas ou três interações. Uma verificação automática
confere que as três ações públicas (ver pendências, responder, anexar) exigem a credencial e passam
pela mesma autorização.

**Protocolo concluído não recebe mais nada.** Documento enviado a processo encerrado ficaria nos
autos sem ninguém para ler, e o cidadão acharia que juntou.

**Anexo do requerente**: PDF, PNG, JPEG ou WEBP até 10 MB, gravado no MinIO com a mesma
compensação do anexo de servidor (arquivo primeiro, registro depois, remove se o insert falhar).
Fica ligado à exigência que responde, e `anexo.enviado_por_requerente_id` — que existia desde 0001
e nunca fora usado — finalmente distingue o que veio de fora.

Na tela do processo, o servidor vê a exigência, a resposta e quantos documentos vieram, com aviso
quando o prazo venceu sem resposta. No acompanhamento público, o cidadão vê o que falta, escreve a
resposta e anexa no mesmo lugar — o texto é enviado antes do arquivo, para que uma falha no upload
não faça ele perder o que escreveu.

## Protocolo virou sistema próprio

Quem atende no balcão não precisa — e não deve — enxergar licitação, contrato e solicitação. O
protocolo saiu de dentro de Processos e virou o quinto módulo contratável, ao lado de Frotas,
Patrimônio e Almoxarifado (migration `0019`).

| Antes | Agora |
| --- | --- |
| `/processos/protocolo` | `/protocolo/atendimentos` (workspace próprio) |
| `/administracao/assuntos` | `/protocolo/assuntos` |
| `/protocolo` (público) | `/cidadao` — acompanhar e abrir |
| Rota da API sem módulo | `resolveTenant("PROTOCOLO")` |

**O papel `PROTOCOLO` foi enxugado** para `protocol:read`, `protocol:serve` e `documents:issue`.
Ele usava `READ_ONLY`, que carrega contratos, licitações, fornecedores e solicitações junto — tudo
fora da atribuição de quem atende. Uma verificação automática recusa qualquer permissão de outro
módulo nesse papel.

**Detalhe do atendimento dentro do protocolo** (`/protocolo/atendimentos/[id]`): sem ele, o
atendente abriria o pedido e nunca mais o veria, já que a tela do processo pertence ao módulo que
ele não tem. Mostra o pedido, o requerente, as exigências e os documentos emitidos — a tramitação
interna continua sendo do setor, no módulo de Processos.

**Prefeitura que já usa Processos ganha Protocolo habilitado na migration.** O atendimento externo
nasceu dentro de Processos; sem essa linha, a separação tiraria do ar um recurso em uso.

### Pego na verificação

- **O painel do produto não oferecia o módulo novo.** `MODULES` no `/admin` tinha sua própria
  lista, que não acompanhou o `CHECK` do banco nem o `ModuleName` — nenhuma prefeitura conseguiria
  contratar Protocolo. Agora há uma checagem que compara as quatro listas (banco, API, tipo do web
  e painel) e falha se divergirem.
- **O harness do proxy acusou a inversão de rota** (`/protocolo` deixou de ser público,
  `/cidadao` passou a ser) — exatamente o que ele existe para pegar.

## Suíte de testes

`cd api && npm test` — executor nativo do Node (`node --test`) com `tsx`, que o projeto já usa no
`npm run dev`. Sem Jest, sem Vitest: nenhuma dependência de teste além do `pgsql-ast-parser`, e
nenhuma configuração fora do `package.json`. Roda no CI ao lado do typecheck, sem banco e sem rede;
a suíte não entra na imagem Docker.

| Pasta | Cobre |
| --- | --- |
| `dominio/` | Por extenso, marcadores e sanitização do modelo, CPF/CNPJ, paginação |
| `aplicacao/` | Casos de uso com repositórios falsos: protocolo, exigência, modelos de documento, solicitação por unidade |
| `estrutura/` | SQL dos repositórios e migrations, ordem das rotas, limites HTTP, contrato entre API e web |

**A regra dos testes de aplicação**: todo caso que espera recusa também confere que **nada foi
gravado**. Regra que valida e grava pela metade é pior que regra que não existe — o estado quebrado
sobrevive à correção do código.

**Por que os testes de estrutura existem**: três bugs desta base não seriam pegos por tipo nenhum —
o papel que existia na API e não no web (`papelBase: invalid enum value`), a lista de módulos do
painel do produto que não acompanhou o `CHECK` do banco, e a rota literal registrada depois da
paramétrica. São checagens baratas que leem o próprio código.

### Dois achados ao montar a suíte

- **Bug real no valor por extenso.** `1.500.000` saía como "um milhão, quinhentos mil reais". A
  regra do "e" olhava só o grupo das unidades (zero), quando quem fecha a frase é o último grupo
  **não nulo** — "quinhentos mil". Corrigido; o caso está fixado no teste.
- **Falso positivo no detector de rota engolida.** A primeira versão comparava só a quantidade de
  segmentos e acusava `/relatorios/uso` por causa de `/viagens/:id`, que nunca a alcança. Agora o
  detector monta o padrão do Express e testa se ele realmente casa — e tem dois testes próprios,
  um de cada lado, porque detector que nunca dispara passa sensação de cobertura sem cobrir nada.

## Documentos emitidos — fatia 3 (patrimônio e frotas)

O motor era genérico desde a fatia 1; o que faltava aos outros módulos era o **escopo** — de onde
a peça fala. Escopo custa código (uma consulta de contexto e um catálogo de marcadores); `tipo`
não custa nada, e a prefeitura cria quantos quiser pelo painel. Migration `0020` abriu seis:

| Escopo | Referência | Peça semeada |
| --- | --- | --- |
| `BEM` | bem | Termo de responsabilidade |
| `TRANSFERENCIA_BEM` | transferência | Termo de transferência |
| `BAIXA_BEM` | bem | Termo de baixa |
| `INVENTARIO` | inventário | Folha de inventário (lista `{{#bens}}`) |
| `VIAGEM` | viagem | Autorização de viagem, Ordem de abastecimento, Relatório de viagem |
| `MANUTENCAO` | manutenção | Ordem de manutenção |

**A transferência tem id próprio; a baixa não.** Um bem transferido três vezes tem três termos, e
apontar para o bem não diria qual delas a peça documenta. Já `baixa_bem` tem o bem como chave
primária — uma baixa por bem —, então o termo de baixa referencia o bem.

**Quatro das tabelas novas não têm `orgao_id`.** `transferencia_bem`, `baixa_bem`, `inventario` e
`manutencao` alcançam o órgão por join no bem, no local ou no veículo. Como o id vem da URL,
consulta sem essa amarra deixaria uma prefeitura imprimir termo sobre o patrimônio de outra. Um
teste lê o SQL da fonte de contexto e exige `orgao_id = $1` em toda consulta de topo; as filhas
(itens, abastecimentos, linhas do inventário) estão numa lista com a justificativa de quem já as
conferiu — sem essa lista, bastaria acrescentar uma consulta sem órgão para o teste ficar mudo.

**Retirada e finalização vêm com traço.** A autorização de viagem é impressa **antes** da saída:
km percorrido ainda não existe, e um zero ali seria lido como "não rodou". O mesmo para o custo de
manutenção em aberto — "R$ 0,00" afirmaria que foi de graça.

**A peça saiu de dentro de Processos.** `/processos/documentos/[id]` virou `/documentos/[id]`, fora
dos workspaces: quem tem papel PATRIMONIO ou FROTAS emitia o termo e caía em tela travada. O
endereço antigo redireciona, porque link de peça oficial pode estar impresso ou colado num e-mail.
O botão de voltar sai de `?voltar=`, validado como caminho interno para não virar redirecionamento
aberto. Papéis PATRIMONIO e FROTAS ganharam `documents:issue`.

Bem ativo oferece o termo de responsabilidade; bem baixado, o de baixa. Transferência recusada não
oferece nada — não houve transferência a documentar. Viagem cancelada não gera autorização.

### Pego na verificação

- **Peça criada pela prefeitura nascia sempre no módulo PROCESSOS.** `criarPersonalizado` tinha
  `modulo: dados.modulo ?? "PROCESSOS"`, e a rota nunca mandava `modulo`. Enquanto todo escopo
  falava de processo isso passava despercebido; com frotas, o administrador criaria a peça, ela
  seria salva e **nunca apareceria na tela**, porque o botão de emissão filtra por módulo. O
  módulo agora sai do escopo. O teste foi conferido nos dois sentidos: falha com o default de
  volta, passa sem ele.
- **O extrator de SQL só enxergava `SQL.nome`.** As consultas da fonte de contexto são constantes
  soltas e ficavam fora da conferência de `$n` — justamente onde os parâmetros são numerados à
  mão. Agora as 23 chamadas do arquivo entram na checagem.
- **Terceira cópia da lista de escopos**, no schema Zod do web, que não acompanhou os seis novos.
  Passou a derivar de `DOCUMENT_SCOPES`; um teste compara a lista do web com a da API.

### Limitação conhecida

A tela `/documentos/[id]` exige sessão, mas não módulo nem permissão específica: qualquer usuário
da prefeitura pode abrir qualquer peça dela pelo id. Foi deliberado — a peça de um atendimento de
balcão pertence ao módulo PROCESSOS, e exigir o módulo travaria a prefeitura que contratou só o
Protocolo. O isolamento entre prefeituras continua na API, que busca pelo órgão da sessão.

## Escolha do contrato e espaçamento das telas

**A lista de contratos agora diz do que trata cada um.** `GET /contratos/para-solicitacao` passou a
devolver **objeto**, **valor do contrato** e **saldo em dinheiro** do que ainda dá para pedir. Antes
a linha trazia só o número, o fornecedor e a vigência — o solicitante escolhia por número, que não
significa nada para quem pede material. O objeto vem da ata ou da licitação, porque o contrato não
tem objeto próprio; o saldo soma item a item, e item medido por percentual ou por valor entra pelo
próprio saldo, já que não tem quantidade × preço.

O fluxo continua em dois passos: escolhe a unidade, vê os contratos dela pelo objeto, e só o
contrato aberto revela os itens.

**Cards encostados nas telas de detalhe.** O espaçamento entre cards dependia de cada página
lembrar de embrulhar tudo num `<Stack>`. Sete telas não lembravam, e como o card tem borda e
sombra, o resultado parecia um passando por cima do outro. A regra virou outra: **o container da
página é uma pilha** (`.content` do painel da prefeitura e do painel do produto), e nenhuma tela
precisa repetir isso. O `margin-bottom` do `PageHeader` e do `Steps` saiu junto — somaria ao gap.

**Tabela vazando do card.** `Table` tem cabeçalho `nowrap`; com sete colunas dentro da coluna
estreita de `Columns`, ela era pintada para fora do card, por cima da coluna ao lado. Três causas
na mesma família, corrigidas juntas: `.card` ganhou `overflow: hidden` e `min-width: 0`, `.stack`
passou a `minmax(0, 1fr)` (item de grade tem largura mínima de **conteúdo** por padrão) e a tabela
ganhou um container de rolagem horizontal — cortar esconderia coluna sem avisar.

`RequestDetailView` devolvia os cards soltos num fragmento e o espaçamento vinha de fora: contrato
invisível que uma das duas telas não cumpria. Agora traz o próprio `Stack` e funciona em qualquer
lugar. Três checagens em `contrato-com-o-web.test.ts` guardam o invariante, porque a correção vive
em CSS e o sintoma só aparece olhando a tela.

## Almoxarifado — 1ª fatia (API)

Ciclo completo até o recebimento, que é o que substitui o sistema legado.
Levantamento em `legado-almoxarifado.md`, decisões em `decisoes.md`.

| Rota | Regra central |
| --- | --- |
| CRUD `/almoxarifado/almoxarifados`, `/tipos` | exclusão travada por remessa ou local vinculado; desativar preserva o histórico |
| GET `/almoxarifado/produtos` | catálogo **global**, sem órgão na consulta |
| GET/PUT `/almoxarifado/configuracao` | reserva liga/desliga + prazo, e limiar do alerta de validade |
| GET/PUT `/almoxarifado/locais/:id` | CNPJ, endereço e responsável do local; vínculo com o almoxarifado |
| POST `/almoxarifado/remessas` | remessa e lotes numa transação só; o produto entra no catálogo global aqui |
| DELETE `/almoxarifado/lotes/:id` | travado se o lote já saiu para alguma unidade |
| GET `/almoxarifado/disponiveis/:almoxarifadoId` | saldo **menos as reservas do mesmo almoxarifado** |
| POST `/almoxarifado/solicitacoes` | rascunho, sem reservar nada |
| POST `/solicitacoes/:id/enviar` | trava os lotes, confere disponível e prende a reserva na mesma transação |
| GET `/solicitacoes/:id/liberacao` | FEFO sugerido, descontando o que outro item da mesma solicitação já consumiu |
| POST `/solicitacoes/:id/liberar` | debita, registra e **baixa a reserva** — tudo numa transação |
| POST `/solicitacoes/:id/receber` | confirma por lote; a diferença vira perda com motivo obrigatório |

**As três correções que o legado motivou**, cada uma com teste:

- *A reserva nasce no envio e some na liberação.* No legado vivia no Redis, era
  criada a cada item do rascunho e nunca era baixada: o material ficava
  reservado e debitado ao mesmo tempo por até 48 horas.
- *Reserva e disponibilidade olham o mesmo almoxarifado.* No legado a reserva
  era por unidade e o saldo somava o órgão inteiro — duas escolas pediam o
  mesmo material e as duas passavam na validação.
- *A liberação é uma transação só.* No legado eram N inserts e updates soltos,
  sem `BEGIN`: falha no meio deixava saldo debitado sem lote de destino.

**O lote sobrevive à entrega.** Cada linha confirmada vira lote na unidade, com
a validade copiada da origem — a escola consome em FEFO o que está no armário
dela. `estoque_local` deixou de ser saldo agregado por produto.

**Validade nunca bloqueia**, em lugar nenhum: lote vencido continua na lista de
liberação, marcado. Quem decide se aquele leite serve é quem está com a caixa
na mão, não uma data no banco.

Papéis: `stock:read`, `stock:request`, `stock:receive` e `stock:manage`.
NUTRICIONISTA administra o estoque da alimentação escolar e emite comprovante;
SERVIDOR pede e confirma recebimento, mas não libera.

### Pego na verificação

- **`$2` como valor e como comparação** em `creditarEstoqueLocal`: o Postgres
  recusa com "inconsistent types deduced for parameter $2" — em tempo de
  execução, no meio do recebimento. O parser estático do `npm test` aceitava.
  Apareceu ao submeter toda consulta a um `PREPARE` num Postgres de verdade,
  passo que virou parte do `db/verificar-migrations.py` e hoje cobre as **297
  consultas** de todos os repositórios.
- **`DELETE ... USING` e `FOR UPDATE OF`** são válidos no Postgres e o
  `pgsql-ast-parser` não conhece. Os `DELETE` viraram subconsulta (mais claros
  de qualquer forma); o `FOR UPDATE OF` ficou, numa lista curta e justificada de
  exceções — com um teste que recusa entrada morta nessa lista.

## Almoxarifado — 1ª fatia (web)

Quinto workspace no hub, cor roxa. Seis telas: pedidos, entradas, saldo por
unidade e os três cadastros (almoxarifados, tipos, locais atendidos).

**Entrada por planilha.** O caminho principal é colar do Excel — é assim que o
material chega, e digitar duzentos itens à mão é o que faz o almoxarife desistir
do sistema. O conversor aceita as variações de cabeçalho que aparecem na prática
(`NOME`/`PRODUTO`/`ITEM`, `QTD`/`QTDE`, `VALIDADE`/`VENCIMENTO`), número
brasileiro (`4.000` é quatro mil, `2,5` é dois e meio) e data nos dois formatos.
Linha de total e separador são descartados e contados.

**Liberação com FEFO ajustável.** A distribuição vem calculada da API e entra
como valor inicial; o almoxarife ajusta porque o lote que vence antes pode estar
no fundo do depósito. Lote vencido aparece marcado, nunca escondido — quem
decide se aquele leite serve é quem está com a caixa na mão.

**Conferência que começa preenchida.** A entrega que fecha é a rotina; obrigar a
digitar item por item faria a conferência virar clique automático. Quem mexe é
quem encontrou diferença — e aí o motivo passa a ser obrigatório, com o total da
perda à vista antes de confirmar.

**Saldo por unidade mostra o lote, não só o total.** Saber que há 40 kg de arroz
não ajuda quem precisa consumir primeiro o que vence antes.

### Pego na verificação

- **`Date.parse("2026-02-31")` não devolve `NaN`.** O JavaScript transborda para
  3 de março e entrega uma data válida, então a validação de data impossível não
  pegava nada: uma planilha com `31/02` gravaria validade de março num lote que
  vence em fevereiro. Agora a data é montada e os componentes são conferidos de
  volta.
- **Dois falsos negativos no meu próprio teste de contrato.** A verificação de
  `exigirPapel` pegava a primeira ocorrência do caminho e caía no `GET` em vez
  do `POST`; e a interpolação `${id}/${acao}` do web virava `:id/:id`. Os dois
  foram conferidos derrubando o código de propósito — o detector acusa e o teste
  volta a passar quando se restaura.
- **`TSX_TSCONFIG_PATH=... npm test` não roda no Windows.** O `cmd.exe` não
  entende variável na frente do comando. O conversor da planilha passou a usar
  import relativo em vez do alias `@/`, e o `npm test` voltou a ser uma linha só.

## Almoxarifado — comprovantes

Quatro peças em **dois** escopos, e não quatro: `SOLICITACAO_ESTOQUE` serve ao
comprovante do pedido, ao romaneio de entrega e ao termo de recebimento, porque
os três falam do mesmo registro e mudam só a lista que imprimem. Escopo custa
código — uma consulta de contexto e um catálogo; `tipo` não custa nada.

| Peça | Escopo | Imprime |
| --- | --- | --- |
| Comprovante do pedido | `SOLICITACAO_ESTOQUE` | `{{#itens}}` — pedido, liberado, recebido |
| Romaneio de entrega | `SOLICITACAO_ESTOQUE` | `{{#lotes}}` — o que segue no caminhão |
| Termo de recebimento | `SOLICITACAO_ESTOQUE` | `{{#lotes}}` com o confirmado e a perda |
| Comprovante de entrada | `ENTRADA_ESTOQUE` | `{{#lotes}}` da remessa |

**O romaneio lista por LOTE, não por produto.** Quem recebe confere caixa por
caixa, e caixa tem validade — agrupar por produto perderia justamente o dado
que se confere. O endereço, o CNPJ e o responsável do local vão impressos: é
para onde a carga vai e quem assina.

**Quantidade que ainda não aconteceu sai como traço, não como zero.** No
comprovante de um pedido recém-enviado, um "0" na coluna de liberado seria lido
como "não me deram nada".

### Pego na verificação

- **O detector de isolamento por órgão disparou** nas três consultas filhas do
  almoxarifado (`ITENS_DO_PEDIDO`, `LOTES_DO_PEDIDO`, `LOTES_DA_ENTRADA`), que
  rodam só depois de o pai ter sido conferido pelo órgão. Entraram na lista de
  exceções com a justificativa — que é o mecanismo previsto, não um contorno:
  sem a lista, bastaria acrescentar uma consulta sem órgão para o teste ficar
  mudo.

## Almoxarifado — 2ª fatia (movimento)

O que acontece com o estoque depois que ele chega. Consumo é o único que faz o
saldo da escola diminuir por uso; devolução, transferência e ajuste são as três
formas de o material andar sem ser consumido. Cada uma existe porque a
alternativa é o servidor resolver por fora e o saldo ficar errado para sempre.

| Rota | Regra central |
| --- | --- |
| POST `/almoxarifado/consumo` | baixa em FEFO sobre o armário da escola; o sistema escolhe os lotes |
| POST `/almoxarifado/devolucoes` | o saldo sai da unidade **no pedido**, não no aceite |
| POST `/devolucoes/:id/responder` | aceite credita o lote de origem; recusa devolve à unidade |
| POST `/almoxarifado/transferencias` | debita a origem e cria uma **remessa de transferência** no destino |
| POST `/almoxarifado/ajustes` | grava o saldo contado, dos dois lados, sempre com motivo |

**Transferir não muda o dono do lote.** O lote pertence a uma remessa, e a
remessa a um almoxarifado — então a transferência cria uma remessa nova no
destino, com lotes que preservam a validade e apontam para a origem. O destino
enxerga a chegada como qualquer entrada, com o mesmo FEFO e o mesmo
comprovante, e o rastro fica no lote.

**O ajuste grava o saldo, não a diferença.** É uma contagem física substituindo
o que o sistema achava que tinha — quem está com o produto na mão sabe quanto
tem, não quanto sumiu. Na unidade ele não passa do que ela recebeu: material a
mais entrou por outro caminho, e o caminho precisa ser registrado, não
escondido num ajuste.

**O ajuste é a válvula que impede o resto do módulo de mentir.** Sem ele, quem
perdeu um saco de arroz lançaria um consumo falso, e o relatório do PNAE viraria
ficção.

### Pego na verificação

- **Dois erros de SQL que só o Postgres pega.** `saldo` ambíguo num
  `UPDATE ... FROM` onde as duas tabelas têm a coluna, e `$1` deduzido como
  texto por aparecer ao mesmo tempo como valor de coluna `uuid` e dentro de
  `substr`. O parser estático aceitava os dois; o `PREPARE` no Postgres real
  recusou. O primeiro virou um `UPDATE` simples com o id já travado na leitura,
  que é mais claro de qualquer forma.
- **Falso negativo no meu detector de `exigirPapel`.** A regex olhava só o resto
  da linha do caminho, e rota com middleware costuma ser quebrada em três
  linhas — a checagem passaria numa rota que perdeu a guarda. Agora varre até o
  início do handler, e conferi derrubando o `exigirPapel` da transferência de
  propósito.
- **N+1 no navegador.** A tela de transferência montava o `<select>` de lotes
  buscando as remessas e depois o detalhe de cada uma — uma dúzia de idas ao
  servidor. Virou uma rota só, `/almoxarifados/:id/lotes`, e o `setState` dentro
  do efeito sumiu junto.
