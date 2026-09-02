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

## Pendente

Revisado em agosto/2026. As fatias 3 a 5 da lista antiga (protocolo externo,
documentos emitidos, suíte de testes) foram entregues e saíram daqui.

### Bloqueia a produção

1. **Repositório privado e chaves rotacionadas.** O `origin` é público no
   GitHub, e o histórico tem as credenciais do MinIO que estiveram no
   `.env.example`. Rotacionar não basta enquanto o repositório estiver aberto:
   as duas coisas andam juntas. Roteiro na seção 7 do `deploy-vps.md`.
2. **Segredos do `.env.prod` regenerados** — `JWT_SECRET`, `AUTH_SECRET`,
   `POSTGRES_PASSWORD` e as chaves do MinIO chegaram a passar pelo
   `.env.prod.example`. Estão queimados.
3. **Migrations 0025, 0026 e 0027 aplicadas na VPS**, e as imagens novas de API
   e web no ar. A matriz de permissões, o parser de `DATE` e o rascunho de
   documento rodam no servidor — sem subir, nada disso existe para o usuário.
4. **Papel dos usuários já cadastrados revisado.** Quem atende numa escola
   provavelmente está como `SERVIDOR`, papel que dá contratos e licitações da
   prefeitura. Passa a ser `UNIDADE`.
5. **`ADMIN_SENHA` removida do `.env.prod`** depois do primeiro login — enquanto
   a variável existir, todo deploy reaplica a senha.

### Funcionalidade combinada e ainda não entregue

6. **Relatório de consumo para o PNAE.** A 2ª fatia do almoxarifado gerou o
   dado (`consumo`, `consumo_lote`), e nenhuma tela o lê.
7. **Importação de planilha de itens** no cadastro de contrato e ata —
   mapeamento de colunas para os campos extras.
8. **Link externo do fornecedor** — token para o fornecedor completar o próprio
   cadastro sem login. `fornecedor_historico` já registra `link_externo` como
   autor; o caminho nunca existiu.
9. **Quatro campos da Ordem de Serviço sem onde morar** — vencimento, processo
   de dispensa, processo de inexigibilidade e cidade do fornecedor. Cada um é
   coluna nova mais campo no formulário. Aguarda dizer quais são exigidos na
   prestação de contas.
10. **Registro de qualidade do lote** — existe no legado do almoxarifado,
    adiado por decisão no levantamento.

### Configuração que não faz nada

11. **Visibilidade estendida da etapa.** Gravada em `fluxo_etapa`, oferecida no
    painel de fluxos, e nenhuma consulta a lê. É a última da família que já
    rendeu três bugs — `dados_contratante`, `usuario_permissao` e esta. Enquanto
    ninguém a ler, o honesto é tirá-la do painel: melhor não oferecer do que
    oferecer sem efeito.

### Testes

12. **Casos de uso de patrimônio e frotas** não têm teste de aplicação. São os
    dois módulos sem repositório falso em `tests/aplicacao`.
13. **Smoke test (`scripts/smoke.ts`) ainda exige ambiente de pé** — não entra
    no `npm test` nem no CI.

### Dívidas técnicas

14. `listarFila` filtra por setor e ignora departamento.
15. Usernames do backfill da migration 0007 são placeholders
    (`prefixo-email.4chars`).
16. **RabbitMQ** está na arquitetura e não tem uso nenhum. Ou aparece um caso
    que o justifique, ou sai do desenho.

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
| Módulo ALMOXARIFADO no `/admin` | **resolvido** — duas fatias no ar, API e web |
| `usuario_permissao` (overrides) | **resolvido** — lida a cada requisição, concede e revoga |
| `dados_contratante` da ordem | **resolvido** — virou marcador `contratante.*` |

Sobra a visibilidade estendida da etapa. Enquanto nenhum código a ler, o honesto é escondê-la do
painel: melhor não oferecer do que oferecer sem efeito.

## Corrigido nesta rodada

- O filtro de bens oferecia o status **EM_AVERIGUACAO**, que o CHECK de `bem.status` não permite —
  filtrar por ele nunca casava nada. E a folha de inventário afirmava que bens não encontrados eram
  "marcados para averiguação", coisa que o código nunca fez. Os dois textos agora dizem a verdade.

## Dívidas conhecidas

- Usernames do backfill da migration 0007 são placeholders (`prefixo-email.4chars`).
- `listarFila` não filtra por departamento (só setor).
- ~~Sem paginação nas listagens.~~ Resolvido.
- ~~Sem rate-limit no auth.~~ Resolvido. Refresh-token continua de fora: a sessão
  dura oito horas e expira sem renovação.
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

## Ordem de Serviço como modelo padrão

O sistema já tinha `ORDEM_FORNECIMENTO`, decalcada da **Ordem de Compras** de
São Bernardo. A **Ordem de Serviço** de Alto Parnaíba é outra peça: numerada em
cinco seções (contratado, contratante, despesa, observações com os itens,
assinaturas), enquanto aquela é um bloco corrido de tabelas. Migration `0024`
acrescenta o tipo `ORDEM_SERVICO` no mesmo escopo — escopo custa código, `tipo`
não custa nada.

### Dois marcadores que faltavam

- **`contratante.*`** — `ordem_fornecimento.dados_contratante` era gravado e
  **nunca lido**: mais uma configuração sem efeito, na mesma família da
  visibilidade estendida. A ordem de serviço nomeia a secretaria
  ("SECRETARIA MUNICIPAL DE EDUCAÇÃO/FUMMDEB"), que é quem responde pela
  despesa. Sem o dado informado, cai no órgão — a peça sai correta em vez de
  sair com lacuna.
- **`contrato.modalidade`** — "Pregão Eletrônico", vindo da licitação direta ou
  da que originou a ata. O dado existia em `licitacao.modalidade` e não chegava
  a documento nenhum.

### O que o PDF tem e o sistema não captura

Ficaram de fora porque não há onde guardar, não por escolha de layout:

| Campo do PDF | Situação |
| --- | --- |
| 2.9. Vencimento | `ordem_fornecimento` não tem a coluna |
| 2.13. Processo Dispensa nº | a modalidade cobre a natureza; o número não existe |
| 2.14. Processo de Inexigibilidade nº | idem |
| Cidade do fornecedor | `fornecedor.endereco` é campo único, sem cidade separada |

Se algum deles for exigido na prestação de contas, é coluna nova mais campo no
formulário da ordem — não dá para resolver no modelo.

## Escopos órfãos: o modelo que ninguém alcançava

A ordem de fornecimento era **gravada e desaparecia**. `criarOrdem` existia;
nenhuma leitura de `ordem_fornecimento` existia. O modal emitia a ordem,
registrava o despacho na linha do tempo — e o `id` dela nunca chegava a
tela nenhuma. Como a peça é emitida por referência (`referenciaId` = id da
ordem), o escopo `ORDEM_FORNECIMENTO` ficou inalcançável desde a 0016. Os dois
modelos dele — ordem de compras e a ordem de serviço da 0024 — passavam nos
testes de renderização e não tinham botão.

O mesmo valia para `SOLICITACAO`: o `COMPROVANTE_SOLICITACAO` da 0016 nunca
teve onde ser pedido. A tela da solicitação só oferecia "Imprimir", que é a
folha timbrada direta — sem código de conferência, sem registro.

### O que passou a existir

- `GET /processos/:id/ordens`, com a mesma guarda do POST (`COMPRAS`, `ADMIN`):
  quem não emite a ordem também não precisa da lista.
- Card **Ordens de fornecimento** no detalhe do processo: cada ordem com
  contrato, valor, empenho e nota, e a emissão da peça logo abaixo.
- Painel de documentos na tela da solicitação, escopo `SOLICITACAO`, liberado
  só depois do envio — rascunho não rende comprovante.

### A ordem nasce preenchida

O formulário oferecia **todos os contratos da prefeitura** e um valor em
branco. A API então recusava, por `contratoParticipaDoProcesso`, o que o
formulário tinha deixado escolher. Agora a lista vem dos contratos da
solicitação daquele processo, e escolher o contrato traz o valor que a
solicitação empenhou nele. O campo continua editável: a ordem pode sair por
parcela do total.

### O teste que trava a classe inteira

`contrato-com-o-web.test.ts` varre as telas que usam `IssueDocumentPanel` ou
`IssueDocumentButton` e exige que **todo escopo do catálogo apareça em algum
filtro**. Escopo sem tela é modelo invisível — aconteceu três vezes. Verificado
derrubando o filtro de `ORDEM_FORNECIMENTO` de propósito.

O mesmo arquivo passou a exigir `app/<base>/page.tsx` para todo `basePath`
declarado em `modules.ts`: o almoxarifado nasceu sem raiz e dava 404 no
primeiro clique do hub, com todas as telas internas existindo.

## `DATE` chegava como `Date` — e sumia o botão de liberar

`TypeError: dataValidade.slice is not a function`, dentro de
`LiberarEstoque.preparar`. O driver do Postgres converte `DATE` para um `Date`
do JS interpretado no fuso do processo; todos os ports declaram estas colunas
como `string`, e o TypeScript nunca percebeu a diferença porque `pool.query`
devolve `any`.

O sintoma foi pior que o erro. `getReleasePlan` falhava, o `.catch(() => null)`
da tela engolia, e o card **Liberar** simplesmente não aparecia — o almoxarife
concluía que não tinha permissão, com o erro real só no log do servidor.

- `pool.ts` registra `types.setTypeParser(1082, …)`: DATE volta como texto.
  `TIMESTAMPTZ` continua vindo como `Date`, porque ali o instante e o fuso
  **são** a informação. Uma data pura não tem hora nem fuso — 2026-08-26 é o
  dia 26 em qualquer lugar, e converter só inventava um horário para depois
  desfazer.
- A tela do pedido passou a mostrar o card com um aviso quando o plano falha,
  em vez de esconder a etapa. Falha que se disfarça de falta de permissão custa
  mais que o próprio erro.
- `fefo.test.ts` confere o parser pelo próprio driver — `types.getTypeParser(1082)`
  aplicado a uma data —, não por leitura do arquivo. Verificado removendo o
  registro de propósito.

## Acesso por escola no almoxarifado — pronto

Três pedidos com a mesma raiz: o cadastro de usuário confuso, a falta de bloqueio
entre escolas e o cadastro de locais preso ao patrimônio. A causa comum era a
escola não ser destino de lotação — o almoxarifado inteiro fala em `local`, mas
a lotação só sabia apontar para unidade, setor ou departamento.

**O vazamento que estava em produção.** A trava por lotação existia só na
escrita. Toda leitura passava com `stock:read` puro: `GET /solicitacoes`,
`/locais`, `/locais/:id/estoque`, `/consumo`, `/devolucoes`, `/qualidade`,
`/ajustes` e `/relatorios`. A escola 1 listava tudo da escola 2.

- **0031** — `lotacao.local_id` como quarto destino (CHECK de exatamente um
  mantido) e `almoxarifado.setor_id`, ambos verificados em Postgres real:
  69 invariantes, incluindo escola+setor na mesma lotação sendo recusada.
- **`AlcanceDeLocais`** — regra pura: escola vence setor; sem lotação, sem
  trava. Nullable de propósito nas duas colunas novas — exigi-las na migration
  tiraria o estoque das mãos de quem já o opera, no minuto do deploy.
- **Onze consultas** ganharam a cláusula, no SQL e não no caso de uso: as rotas
  de consumo, devolução, ajuste e transferência falam com o repositório
  **direto**, sem passar por caso de uso nenhum, e filtrar lá em cima deixaria
  essas quatro de fora. O parâmetro é obrigatório no tipo — o compilador
  encontrou as 16 chamadas, e nenhuma escapou por esquecimento.
- **Locais atendidos** — criar, renomear e inativar em `/almoxarifado/locais`
  com `stock:manage`, na mesma tabela `local`. Reativar existe: inativar sem
  volta seria porta de mão única. Inativo aparece só na tela de cadastro,
  nunca nos seletores.
- **Cadastro de usuário** — papéis agrupados pelo módulo que servem (o select
  eram dez opções planas sob "nível de acesso"), escola como destino, lotação
  visível na lista e **editável**: antes ela só entrava na criação, e cadastrar
  a diretora na escola errada exigia recadastrar a pessoa.

Verificado quebrando cada guarda: tirar a cláusula de uma consulta, filtrar
pela coluna errada e inverter a precedência escola/setor — os três acusam.
Um deles foi pego por dois testes independentes.

**Pendente de decisão sua:** os almoxarifados existentes estão sem setor, e
enquanto estiverem, qualquer lotação de setor os alcança. O preenchimento é na
tela de almoxarifados, um por um.

## Devoluções concluídas

**Um bug antes das features.** Clicar em "Filtrar" com o select em "Todos os
locais" mandava `?local=`, e o `""` seguia até o SQL como `$n::uuid`: quatro
telas do almoxarifado respondiam "Erro interno". Cada rota escrevia à mão
`typeof req.query.x === "string"`, que devolve `""` para campo presente e vazio
— e o mesmo descuido estava em patrimônio, processos, contratos e solicitações.
`filtroDaQuery` passa a ser o único caminho, um teste proíbe o padrão inline, e
`22P02` responde 400 em vez de 500.

- **Comprovante de devolução** — escopo `DEVOLUCAO_ESTOQUE`, modelo global na
  0032 e tela de detalhe em `/almoxarifado/devolucoes/[id]`. Era a única
  movimentação do módulo sem peça: entrada, pedido e relatório já tinham. Uma
  peça só serve aos três estados; um modelo por estado seriam três textos para
  manter sincronizados.
- **Fila separada** — duas abas, porque são dois trabalhos: o que espera
  resposta é fila (com a contagem no rótulo), o resto é histórico. Misturados,
  a fila sumia dentro da lista conforme as respondidas se acumulavam. As abas
  saíram da fila do setor para um `TabNav` compartilhado, em vez de copiadas.

**O verificador tinha um buraco.** Ele só preparava consultas dentro de
`SQL = { … }`, e `PostgresFonteDeContexto` usa constantes soltas — o motor de
documentos inteiro nunca passou por `PREPARE`. Um `d.data_validade` que não
existe só apareceu ao emitir o comprovante contra um Postgres de verdade.
Corrigido: 351 → **375 consultas conferidas**, 24 delas pela primeira vez.

## Contrato, ordem e apresentação — pronto

Cinco pedidos do uso real, com o módulo de Processos já em produção.

- **Itens editáveis** — todos os campos, inclusive quantidade e valor. A trava é
  uma só: a quantidade não desce abaixo do que já saiu em solicitação, porque o
  saldo ficaria negativo e o contrato deveria material que não tem. Item com
  consumo também não é excluído — o pedido antigo aponta para ele. O saldo
  acompanha a correção (`saldo + (novo − antigo)`), senão aumentar a quantidade
  criaria unidades que ninguém poderia pedir.
- **Teto da licitação** — bloqueio ao salvar, somando os contratos que já
  nasceram dela. Fechar exatamente no valor autorizado é permitido; um centavo
  além, não. A conta é em centavos: em ponto flutuante, `0.1 + 0.2 > 0.3`, e o
  contrato que fecha no teto seria recusado por um erro invisível ao usuário.
  Contrato de ata fica de fora — a ata tem saldo próprio, por item.
- **Ordem visível à controladoria** — a listagem pedia `processes:order`, a
  mesma permissão de emitir, então quem precisa conferir para dar parecer não a
  via. Passou a `processes:read`.
- **Nota fiscal** — `orders:invoice`, nova, para compras e controladoria. É a
  primeira escrita da controladoria, e é deliberada: informar o número é ato de
  conferência. Continua editável, e em branco grava `NULL` — string vazia
  colidiria no índice de unicidade na segunda ordem do mesmo fornecedor.
- **Apresentação** — primeira seção do contrato e da licitação: o fornecedor
  com endereço e contato (que só existiam duas telas adiante) e o procedimento
  com modalidade, objeto, valor e assinatura.

**Uma divergência que a edição tornou visível:** o valor do contrato é digitado
e a soma dos itens é outra conta, e nada as confrontava. Ficaram separadas por
decisão — o arredondamento do edital nem sempre bate com a soma —, mas a tela
agora mostra as duas e avisa quando diferem. Por consequência, o valor virou
editável: um aviso sem conserto possível seria só um incômodo.

**573 testes**, 72 invariantes em Postgres real, 381 consultas com `PREPARE`.
Verificado contra a API no ar, com banco de verdade, e quebrando cada guarda:
teto virando "menor que", teto sem centavos, piso do item virando o saldo, e
exclusão ignorando o consumo — os quatro acusam.

## Checklist — 1ª fatia pronta

Módulo contratável para acompanhar o cumprimento de exigências, por dentro. O
link externo do fornecedor fica para a 2ª fatia.

- **0033** — modelos, checklist com alvo polimórfico (processo, contrato,
  fornecedor… ou nenhum), itens com responsável e prazo, cumprimento como
  **tabela de ciclos**, anexo próprio e o módulo `CHECKLIST`.
- **0034** — escopo `CHECKLIST` no motor de documentos, com a declaração de
  conclusão como modelo global.
- **O item não tem coluna de status.** A situação é derivada do último ciclo, e
  a regra existe em três lugares que precisam concordar: domínio (TypeScript),
  repositório (SQL, para contar "em aberto" sem trazer tudo) e web (para pintar
  a tela). Guardá-la exigiria alguém para expirá-la, e uma coluna dizendo
  "cumprido" sobre certidão vencida mente.
- **Ciclos, não campos.** Cumprir de novo não apaga o anterior: a prestação de
  contas do ano passado precisa mostrar a certidão que valia naquele momento.
- **Quem cumpre marca, quem cobra confere** — permissões separadas
  (`checklists:fulfill` e `checklists:verify`). O anexo é cobrado na
  **conferência**, não no cumprimento: ele pende do ciclo, que precisa existir
  antes de o arquivo poder subir.
- **Completo hoje**, e não completo: item recorrente faz a lista voltar a
  incompleta sozinha. A emissão da declaração fica bloqueada com item em aberto.

**Erros que a verificação pegou**, e que valem registro:

1. O CHECK de recorrência aceitava item recorrente **sem** periodicidade:
   `TRUE AND NULL > 0` é `NULL`, e CHECK com `NULL` passa. Só apareceu no
   Postgres de verdade.
2. Comentários `/** */` no SQL: o Postgres aceita, e o parser do `sql.test.ts`
   morre neles.
3. `DELETE ... USING` e `UPDATE ... FROM`: válidos no Postgres, desconhecidos
   do parser. Reescritos com subconsulta.
4. **Dois testes apontavam migrations pelo nome** (`0019` e `0014`) e mediam
   CHECKs que outra migration já havia substituído — continuariam verdes
   enquanto o banco recusava o módulo novo. Passaram a procurar a última.

**624 testes**, 90 invariantes, 410 consultas com `PREPARE`. Verificado com a
API no ar contra Postgres real: ciclo completo, vencimento devolvendo o item a
pendente, isolamento entre prefeituras (404 dos dois lados) e a matriz de
permissões. Três guardas quebradas de propósito — as três acusam.

**Pendente:** ligar `CHECKLIST` para a prefeitura no `/admin` — módulo novo não
se liga sozinho, e foi assim que o almoxarifado "não apareceu".


## Checklist — módulo concluído

A 2ª fatia fecha o módulo: o fornecedor cumprindo exigências pelo link, sem
conta no sistema.

- **0035** — `checklist_convite`, com o desenho do convite de fornecedor.
- **`/publico/checklist/:token`** — abrir, cumprir e anexar. Sem sessão e sem
  tenant: o órgão vem do convite, que vem do checklist.
- **`/exigencias/:token`** no web — página sem a casca do sistema, com o que
  falta, o que foi recusado e o que vence.
- **Botão de link** na tela do checklist, com o token aparecendo **uma vez**.

**Um erro que a verificação pegou, e que valeu a pena:** o CHECK
`expira_em > criado_em` recusou o meu próprio teste, que tentava simular um
convite expirado mexendo só numa das datas. A constraint estava certa — ela
impede um convite que expira antes de nascer, e o teste é que pedia um estado
impossível.

**633 testes**, 95 invariantes, 417 consultas com `PREPARE`. Verificado com a
API no ar: o link mostra 1 item de 2, o item interno responde 404 pelo link, o
ciclo nasce marcado como externo e sem usuário, os quatro tipos de token ruim
dão a mesma resposta, e a rota interna sem sessão dá 401. Quatro guardas
quebradas de propósito — as quatro acusam.

**Pendente do módulo:** ligar `CHECKLIST` para a prefeitura no `/admin`.

## Upload quebrado, modais e layout do checklist

**O anexo não subia — em lugar nenhum.** As pontes do Next descartavam o
`Content-Type` quando o corpo era multipart, com a intenção de deixar o `fetch`
montar o boundary. Só que o corpo atravessa a ponte como stream **já
codificado**: o boundary vive dentro do cabeçalho, e o fetch só o regeneraria
se recebesse um `FormData` montado por ele.

Sem o cabeçalho, o multer não encontrava o arquivo e devolvia "Arquivo
ausente". Reproduzido contra a API no ar: **com** o `Content-Type` o upload
chega ao armazenamento; **sem** ele, 422. Valia para anexo de processo, de
checklist e do requerente — as três pontes tinham a mesma linha, copiada.

Corrigido nas três, com um teste que procura o padrão pela forma: foi copiado
três vezes, e a quarta cópia entraria pelo mesmo caminho.

**Os modais quebravam no campo de arquivo.** O `input[type=file]` é o único
controle que o navegador desenha por conta própria, e o timbre da entidade o
usava dentro de um `InputField` — que aplica `height: 38px`, altura em que um
botão nativo não cabe. Nas outras três telas ele aparecia cru, com um `<label>`
improvisado: quatro aparências para o mesmo controle, e o nome de um arquivo
longo empurrando o diálogo para fora.

Agora existe `FileField`: caixa do sistema, botão nativo estilizado por
`::file-selector-button`, e o nome truncado em vez de transbordar.

**O layout do checklist** tinha 54 `style={{}}` inline onde o resto do sistema
usa CSS Modules — sem `:hover`, sem media query, e a mesma caixa de item escrita
três vezes com três medidas. Passou a `Checklist.module.css`, com as opções em
`flex-wrap` (num modal estreito as três caixas não cabiam lado a lado) e a
página pública com respiro próprio no celular.

## Checklist — o PNTP da planilha do cliente

O arquivo real ("Relatório de Prevenção Mensal — PNTP e TCE") mostrou que o
ciclo estava certo e faltava o que organiza sessenta linhas.

- **0036** — `secao` (a DIMENSÃO), `codigo` (o número oficial: 2.2, 8.5),
  `classificacao` (Obrigatória/Essencial/Recomendada), anexo de referência
  (o "BAIXAR") e a tabela de **apoios** — o "COM JURÍDICO" da planilha, que
  vê o item na fila sem responder por ele.
- **0037** — os **53 critérios** semeados como modelo global
  (`orgao_id IS NULL`): 16 dimensões, 33 obrigatórias, 5 essenciais, 15
  recomendadas. Conferido contra o banco: os números batem com a planilha.
- **Contagem por peso** — a tela diz "3 obrigatórias e 1 essencial", não
  "4 pendências". É o que decide onde a prefeitura corre, porque é a
  obrigatória que o TCE cobra. A concordância mora no domínio, não no JSX.
- **Vínculo por busca** — o formulário pedia **UUID colado à mão**. Agora
  procura pelo número do processo, do contrato, da licitação ou pelo CNPJ, com
  espera de 300 ms entre teclas. E o caminho principal inverteu: **"Novo
  checklist" dentro do processo e do contrato**, já vinculado.

**Duas medidas que não cabiam:** o título do item era `VARCHAR(200)`, pensado
para "Certidão negativa de débitos" — o maior critério do PNTP tem 247
caracteres, e cortá-lo perderia justamente o que se deve conferir. E o `Card`
não tinha ação no cabeçalho; ganhou, com a borda migrando do título para o
cabeçalho, senão ela cortava a linha ao meio.

**Limitação conhecida, e deliberada:** o modelo global **não traz o
responsável**. A planilha diz "CONTABILIDADE COM JURÍDICO", e esses nomes são
de uma prefeitura — o modelo é de todas. O setor sugerido pelo Tribunal fica no
texto da descrição, e quem aplica atribui o responsável na cópia. São 53
atribuições manuais na primeira vez; a alternativa seria adivinhar o
organograma alheio.

**654 testes**, 104 invariantes, 422 consultas com `PREPARE`. Quatro guardas
quebradas: modelo deixando de ser global, código repetido, contagem perdendo o
peso e conferência voltando a contar como pendência — as quatro acusam.

## Três correções sobre o checklist e a devolução

**O modelo global estava invisível.** Semeado na 0037 com `orgao_id IS NULL`,
não aparecia em lugar nenhum porque a listagem filtrava por órgão. Agora
aparece marcado como "padrão do sistema", pode ser aplicado e duplicado, e a
edição direta é recusada com 422 explicando o caminho. Aplicá-lo passou a levar
seção, código, classificação e apoios — antes só os títulos iam.

**A devolução quebrava sem deixar rastro.** Reproduzido em jsdom: um furo na
lista de lotes fazia `lote.id` estourar durante o render, com exatamente a
mensagem que apareceu no navegador. Corrigido na origem (as consultas
normalizam) e no destino (`opcoesDeLote`, testável sem navegador, descarta o
que não serve). Oito cenários degradados que antes derrubavam a tela agora
desenham.

**O seletor de referência sumia calado.** Ele selecionava certo — o teste
confirma —, mas com resposta fora do array o `<select>` simplesmente não
aparecia, sem uma linha de explicação. Agora "não achei" e "não consegui
consultar" são mensagens diferentes.

**Verificação:** 655 testes na API, 9 no web (nova suíte, já no CI), 104
invariantes e 423 consultas com `PREPARE`. A trava de asserção non-null foi
quebrada de propósito e acusou. Contra Postgres e API no ar: o global aparece,
recusa edição, duplica com os 53 itens, e o checklist aplicado nasce com 53/53
seções, códigos e classificações.

**Pendência que fica:** a listagem de checklists mostra o alvo pelo id, não pelo
número do processo — falta o join na API.

## Pendências de segurança

**O que vazou não era a chave deste MinIO.** O `api/.env.example` do primeiro
commit era um `.env` de trabalho renomeado, apontando para
`bucket.administracaopublica.com.br` — um servidor de armazenamento externo.
Rotacionar a chave local não invalida aquela credencial: a revogação precisa
acontecer no servidor de fora. Ficou público em 11/08; o repositório tem 0
forks e 0 stars, o que não diz nada sobre quem apenas clonou.

**Três scripts novos**, todos exercitados antes de entregar:

- `rotacionar-minio.sh` — gera o par na VPS, recria minio, minio-init e api,
  **prova** que a chave nova abre o bucket e volta sozinho se não abrir. Testado
  com um `docker` simulado nos três caminhos: ensaio sem efeito, prova falhando
  com reversão byte a byte, e caminho feliz. Nenhum segredo aparece na saída.
- `procurar-segredo.sh` — roda no CI a cada push e bloqueia a publicação da
  imagem. Acusa o vazamento real no histórico e o ignora depois de limpo; cinco
  cenários conferidos, zero falso positivo em 56 commits.
- `limpar-historico.sh` — descobre sozinho o que remover (não carrega o segredo
  escrito, senão a ferramenta de apagar credencial seria o último lugar onde ela
  sobrevive), pede confirmação, faz espelho de segurança e reescreve. Testado em
  clone descartável: 56 commits preservados, arquivo antigo intacto com o valor
  substituído.

**Rotação por idade**, ligada ao `deploy.sh`: `ROTACAO_MINIO_DIAS` no
`.env.prod`, padrão 30, `0` a cada atualização, `-1` desliga. Acontece antes de
trocar a imagem — se falhar e reverter, a produção fica na versão que já
funcionava.

**Não pôde ser testado aqui:** a rotação contra um MinIO de verdade. O ambiente
não tem Docker e o binário do MinIO está fora de alcance. É por isso que o
script prova e reverte em vez de confiar.

**Falta, e é com o João:** revogar a chave no servidor externo, tornar o
repositório privado, rodar os dois scripts na VPS, refazer o clone de lá depois
da reescrita, e tirar `ADMIN_SENHA` do `.env.prod` — enquanto estiver lá, todo
deploy reaplica aquela senha.

## Polimento do checklist

**O botão que não respondia** era validação reprovando num campo invisível. O
caso foi corrigido e a classe também: nenhum formulário do sistema fica mudo ao
reprovar. Seis testes novos no web cobrem a busca da mensagem na árvore de
erros.

**Criação em passos** — vínculo, conteúdo, revisão —, com o TargetPicker
ganhando o passo inteiro. Os oito movimentos do assistente foram exercitados em
jsdom: trava sem escolha, trava sem registro, trava sem título, avança com
modelo, e envia o vínculo e o modelo corretos.

**Migration 0038**: modelo global de liquidação e pagamento, sete etapas, três
delas do fornecedor. Conferido contra Postgres de verdade com a API no ar —
aplicado a um processo, os sete itens nascem com seção e exigência de anexo, e
o link externo mostra exatamente três.

662 testes na API, 15 no web, 104 invariantes, 423 consultas com `PREPARE`.

## Número repetido, modalidades, categorias e busca

**Número livre** em licitação, contrato e ata (migration 0039): a numeração
reinicia a cada exercício e a da ata vem do órgão de origem. As três checagens
prévias e o `existeNumero` inteiro saíram do código.

**Dezenove modalidades** (0040) num catálogo único com a sigla do Tribunal, com
teste estrutural ligando domínio, CHECK do banco e o espelho do web — quebrei os
três de propósito e os três acusam.

**Categoria no item** (0041), texto livre e opcional, com agrupamento em faixas
na tela do contrato e na da solicitação. Oito testes no web cobrem o agrupador:
vazio e nulo no mesmo bloco, bloco sem categoria por último, acento ordenando
como em português, lista fora do formato não derrubando nada.

**Busca do contrato** na solicitação, por número, objeto, fornecedor ou número da
origem, no lugar da lista completa.

**Verificação** contra Postgres com a API no ar: duas licitações com o mesmo
número entram; as 19 modalidades passam pelo CHECK; contrato nasce com itens em
duas categorias e um sem, e `"  "` chega ao banco como nulo; a busca acha por
número e por fornecedor.

668 testes na API, 22 no web, 104 invariantes, 420 consultas com `PREPARE`.

**Fica para decidir:** a busca não olha o nome do produto — procurar "seringa"
não acha o contrato que a tem. Dá para incluir, ao custo de um `EXISTS` sobre a
tabela de itens em toda tecla digitada.

## Categoria em lote e listagens divididas

**Na importação**, um campo de categoria antes de confirmar aplica a categoria a
todo o lote colado. Exercitado em jsdom: o lote inteiro nasce com ela, o
segundo lote não mexe no primeiro, as categorias usadas viram sugestão, e em
branco o item fica sem categoria.

**Nas listagens**, `LinhasPorCategoria` agrupa os itens no detalhe do contrato,
no detalhe da solicitação e na montagem do pedido. A solicitação passou a trazer
a categoria da API — uma coluna a mais no `SELECT` que já lê a tabela de itens.

**Duas pontas soltas fechadas:** o `datalist` de sugestões, que existia como
atributo apontando para um elemento inexistente, e a coluna de produto, que
ficava espremida porque nenhuma largura era declarada — agora tem a mesma de
descrição.

## Produto sem teto de caracteres

Migration 0042: `item.produto` e `ata_item.produto` viraram TEXT; os cinco
schemas Zod passaram de 150 para 2000. Teste estrutural trava a volta do teto e
a perda da migration — quebrei os dois de propósito e os dois acusam.

No editor, o produto virou textarea de duas linhas; nas listagens, a célula
quebra em vez de esticar a tabela.

Contra Postgres com a API no ar: item com especificação de mil caracteres grava
e volta idêntico, e 2500 é recusado com o motivo no campo certo.

671 testes na API, 22 no web, 104 invariantes, 420 consultas com `PREPARE`.

## Capa do processo administrativo

Migration 0043: capa decalcada da folha de Monção como modelo global, escopo
`PROCESSO_CONTRATO`. Sem código de barras (o QR de conferência já vai no rodapé)
e sem dados bancários.

`processo.descricaoPedido` virou marcador — o campo era gravado desde o balcão e
nenhum código o lia, quinto caso de configuração sem efeito no projeto.

**Defeito antigo corrigido no caminho:** CNPJ e CPF saíam sem máscara em toda
peça emitida. A ordem de serviço e a de fornecimento imprimiam o número cru
desde que existem.

Verificado com Postgres e API no ar: capa emitida sobre um processo com
contrato, fornecedor e solicitação — nenhum `{{marcador}}` sobrou no corpo
gravado, valor por extenso e modalidade corretos, CNPJ mascarado.

677 testes na API, 104 invariantes, 420 consultas com `PREPARE`.
