# Log de decisões (consolidadas com o cliente)

Cada item abaixo foi discutido e aprovado explicitamente durante o levantamento.
Alterar qualquer um exige nova aprovação do usuário.

## Transversais

- **Multi-tenant**: banco único, isolamento por coluna `orgao_id` em toda tabela de tenant.
- **Fornecedor é cadastro GLOBAL** (sem orgao_id): editável por qualquer prefeitura e pelo próprio
  fornecedor via link externo (link ainda não implementado); toda alteração grava
  `fornecedor_historico` com dados anteriores e autor. Certidões/documentos nunca ficam no cadastro
  global — sempre no processo/contrato da prefeitura.
- **Requerente é local** (cidadão, outro órgão, servidor, ou ponteiro para fornecedor global).
- **Módulos habilitados por prefeitura** (`orgao_modulo`), controlados pelo super admin. Usuário só
  acessa ferramentas de módulos ativos do seu órgão (middleware `resolveTenant("MODULO")`).
- **Papéis**: catálogo fixo (ADMIN, GESTOR, SERVIDOR, PROTOCOLO, COMPRAS, CONTROLADORIA,
  NUTRICIONISTA) + overrides pontuais em `usuario_permissao`.
- **Login sem CNPJ**: identificador (e-mail OU username) + senha; ambos únicos globalmente; o órgão
  vem do registro. Se surgir usuário em 2+ prefeituras, evoluir para conta global + `usuario_orgao`.
- **Lotações múltiplas**: usuário tem N lotações, cada uma apontando para exatamente um destino
  (unidade OU setor OU departamento). Toda ação registra em nome de qual lotação foi feita.
- **Duas hierarquias paralelas**: Unidades (secretarias — consomem: recebem contratos, solicitam) e
  Setores funcionais (processam: Protocolo, Compras, Controladoria, Alimentação Escolar...).
  Departamento pertence a setor e é endereçável no fluxo (fila própria).
- **Auditoria**: só eventos de negócio (despacho, parecer, cancelamento, aprovação, mudança de
  setor) — não toda edição de cadastro. (Tabela existe; gravação ainda não plugada.)
- **Numeração**: sequencial/ano com sequências separadas por tipo (`numeracao_sequencia`):
  protocolo 000123/2026, processo adm 048/2026, ordem 0001/2026.
- **Documentos emitidos**: todo módulo gera comprovantes/declarações/relatórios via
  `documento_emitido`, com código pesquisável que vira QR interno. Timbre/logomarca por prefeitura
  em `orgao_documento_config`. (Geração ainda não implementada.)
- **Local físico é cadastro compartilhado** entre patrimônio e almoxarifado; pode reaproveitar
  unidades (admin escolhe quais) ou ser avulso (escola, hospital).
- **Sem sigilo de processos nesta fase.** Transparência como princípio.

## Módulo Processos (implementado)

- Fluxo de tramitação configurável **por prefeitura** (padrão geral), etapas com prazo em dias
  configurável e liga/desliga; visibilidade estendida concedível por etapa (ex.: Controladoria ver
  tudo); override manual de destino apenas se liberado no fluxo.
- Ordem levantada na reunião: Protocolo → Compras → Controladoria.
- **Parecer da Controladoria é a etapa final (a aprovação)**, por processo inteiro (não parcial).
  Desfavorável em solicitação de itens devolve saldo aos contratos. Encerra o processo.
- **Reserva de saldo só é liberada por ação explícita** (cancelamento ou parecer desfavorável).
  Sem expiração automática neste módulo. Solicitante, Compras e Controladoria podem cancelar.
- **Item**: modo de medição fixo por item (UNIDADE | PERCENTUAL | VALOR), definido no cadastro do
  contrato. Núcleo fixo (produto, descrição, unidade, marca, quantidade, valores) + campos extras
  definidos por contrato (`contrato_campo_extra`/`item_valor_extra`) — planilhas variam.
  Entrada manual + importação de planilha (importação ainda não implementada).
- **Solicitação multi-contrato** (rastreabilidade por item via item_id → contrato). Rascunho sem
  números e sem reserva — ambos só no envio. **Sem edição pós-envio**: cancelar e refazer.
- **Uma ordem de fornecimento por contrato/fornecedor** do processo. **NF única por
  fornecedor dentro da prefeitura** (orgao_id + fornecedor_id + numero_nota_fiscal).
- **Protocolo e processo administrativo nascem apenas na solicitação.** Licitação, ata e contrato
  são cadastros de base, sem numeração de processo (revisto em 2026-08-13; a regra anterior, de o
  contrato abrir processo, foi desfeita pela migration 0009).
- **Contrato**: origem obrigatória licitação OU ata. **Fim de vigência é opcional** — em branco
  significa prazo indeterminado (migration 0010). Vigência vencida **alerta, não bloqueia**.
  Fiscal = texto livre nome/matrícula. Dotação orçamentária: N linhas opcionais.
- **Assistente "Iniciar procedimento"** é o caminho principal: escolhe a origem, cadastra
  licitação ou ata e pergunta se o contrato entra agora; cadastro avulso continua disponível nas
  listagens.
- **Licitação**: número/ano + campos da reunião; modalidade em lista fixa do sistema.
- **Ata**: número/ano próprio, vigência (vencida não origina contratos — alerta), itens copiáveis
  ao contrato, **sem fornecedor** (fornecedor só no contrato).
- **Protocolo é a porta de entrada genérica** (interno + atendimento externo de balcão para
  qualquer parte: fornecedor, cidadão, outro órgão). Atendimento externo ainda não implementado.

## Módulo Frotas (implementado)

Fluxo próprio simples (SOLICITADA→APROVADA/RECUSADA/REMARCADA→RETIRADA→FINALIZADA), sem motor de
processos. Compartilhamento de veículo entre secretarias configurável por prefeitura. Motorista com
cadastro próprio (CNH, categoria, validade, alerta). Manutenção como histórico (aberta = veículo
indisponível). Nota de combustível por LITRO ou VALOR, registro independente de contratos. Conflito
de agenda só avisa — gestor decide. Sinistro texto livre. Extras: agenda visual + relatórios de uso.

**1ª fatia entregue**: veículos, motoristas e o ciclo completo da viagem
(SOLICITADA → APROVADA/RECUSADA/REMARCADA → RETIRADA → FINALIZADA), mais manutenção. Decisões
tomadas na implementação, todas reversíveis:

- **Motorista continua obrigatório na solicitação**, como o schema previa; `retirada.motorista_id`
  registra quem de fato levou o veículo, que pode ser outro. Se a prefeitura preferir que o gestor
  escale o motorista só na aprovação, é migration para tornar `viagem.motorista_id` opcional.
- **Barreiras na solicitação**: veículo inativo ou em manutenção não é ofertado; motorista com CNH
  vencida também não. Vencendo em até 30 dias só alerta.
- **Hodômetro não anda para trás**: km da retirada ≥ km do veículo, km final ≥ km da retirada. A
  finalização grava finalização + status + km do veículo na mesma transação.
- **Compartilhamento entre secretarias** respeitado na solicitação: veículo com unidade dona só é
  pedido por ela, salvo com `frota_config.compartilha_entre_secretarias` ligado.
- **Conflito de agenda só avisa** (janela de 4h para frente e para trás), como decidido — a API
  devolve os conflitos junto com a viagem criada e a tela mostra no toast.
**2ª fatia entregue** — o módulo está completo:

- **Abastecimento durante a viagem**: litros, valor, ou os dois; só aceito de viagem RETIRADA ou
  FINALIZADA (antes da retirada não há o que abastecer). É coisa distinta da nota de combustível
  entregue na retirada, que continua no registro da retirada.
- **Agenda semanal**: grade veículo × dia, com navegação de semana, viagem clicável, cor por
  situação e veículo em manutenção ou inativo sinalizado. Veículo sem viagem na semana continua na
  grade — a ociosidade é a informação mais útil ali.
- **Relatório de uso** por período: viagens finalizadas, km rodado, litros, gasto com combustível e
  com manutenção, por veículo e no total, com consumo médio em km/L. Km e viagens contam pela data
  de **finalização**; manutenção pela data de **abertura**.

## Painel do produto: alcance total sobre a prefeitura (implementado)

Além dos administradores, o `/admin` gere **unidades, setores e usuários** de cada prefeitura —
as mesmas operações que o ADMIN dela tem, com o órgão vindo da URL em vez do token. Serve para o
suporte destravar cliente sem pedir a senha de ninguém. O painel também gere os **administradores
do próprio produto** (`admin_sistema`): listar, criar, redefinir senha e ativar/inativar, com duas
travas — ninguém inativa o próprio acesso, e o sistema nunca fica sem nenhum admin ativo (de onde
só se sairia por SQL).

O `/admin` virou lista de prefeituras; módulos, timbre, administradores e cadastros passaram para
`/admin/prefeituras/[id]`. Antes tudo isso carregava para **todas** as prefeituras na mesma tela.

## Painel do produto: administradores da prefeitura (implementado)

O `/admin` deixou de só **criar** o primeiro ADMIN e passou a **gerir** os administradores de cada
prefeitura: listar com situação, criar outro, promover servidor existente (sem duplicar cadastro),
redefinir senha e ativar/inativar.

- **A prefeitura nunca fica sem administrador ativo**: inativar o último devolve 422 pedindo que se
  crie ou promova outro antes. Sem isso, ninguém lá dentro cadastra usuário nem configura nada, e
  só o fornecedor destrava.
- **Redefinição de senha pelo fornecedor** existe para o caso em que o administrador da prefeitura
  perde o acesso e não há mais ninguém para socorrê-lo — antes só se resolvia por SQL.
- **Tudo fica na auditoria da prefeitura**, com o nome e e-mail do admin do produto que executou.
  O autor vai em `detalhes`, não em `usuario_id`: o admin do sistema não existe na tabela `usuario`.
  O token do painel passou a carregar nome e e-mail para isso.

## Prazos de etapa e auditoria (implementado)

Os campos `prazo_dias`/`prazo_ativo` do fluxo já eram configuráveis desde o começo, mas **nenhum
código os lia** — o gestor preenchia e nada acontecia. Agora:

- **Entrada no setor** = data do último despacho de ENCAMINHAMENTO, ou a abertura do processo se
  ele nunca se moveu. Só ENCAMINHAMENTO desloca (parecer encerra, ordem não move), então o último
  encaminhamento é exatamente o que pôs o processo onde ele está.
- **Vencimento** = entrada + `prazo_dias` da etapa do fluxo correspondente ao setor atual, quando
  `prazo_ativo`. A conta é feita no banco com o `now()` do servidor — o relógio do navegador não
  entra.
- **A fila vem ordenada pelo mais urgente**, com aviso no topo de quantos passaram do prazo. Faixa
  de alerta: 2 dias antes do vencimento.
- **Prazo é sinalização, não bloqueio.** Processo vencido continua tramitando normalmente.

A **tela de auditoria** passou a consumir o `GET /auditoria` que já existia: filtro por tipo de
evento (agrupado por módulo), período (padrão: últimos 30 dias) e paginação. Os enums viram frase
em português — a trilha é lida por gestor, não por dev. Linha sem usuário é ação do fornecedor pelo
painel; o autor fica em `detalhes`.

## Navegação: um sistema por módulo (implementado)

Cada módulo é um **sistema à parte**, com URL, navegação e cor próprias — nenhuma tela cita
tela de outro módulo. A raiz `/` é um hub que lista só os sistemas liberados para o papel e para
a prefeitura. Prefixos: `/processos`, `/patrimonio`, `/administracao` (unidades, setores e
usuários, que servem a todos os sistemas). O `WorkspaceShell` injeta a cor de destaque do módulo
e redireciona para `/modulo-indisponivel` se a prefeitura não tiver o módulo.

## Módulo Patrimônio (implementado)

Código de tombamento **fixo desde a origem**: `<código do local>-<sequencial por local>` (001-214);
local atual é campo separado. Categorias de bem por prefeitura. Estados de conservação + baixa
formal com motivo. Remessa com origem opcional (fornecedor/contrato/ordem). Lote gera N bens
individuais. **Transferência exige aceite do destino** (PENDENTE→ACEITA/RECUSADA). Inventário
periódico por local com divergências. Fora desta fase: valor de aquisição, fotos/QR físico, termo
de responsável.

**Exclusão deixa buraco na numeração**: apagar uma entrada apaga os bens dela, mas o contador do
local **não é estornado** — tombamento não se reaproveita, porque a etiqueta pode já estar colada no
bem. Excluir entrada ou bem é bloqueado (422) se algum deles já foi conferido em inventário.
**Editar bem** alcança só nome e categoria: código é definitivo e local muda por transferência.
**Editar entrada** alcança só os dados da nota (data, fornecedor, NF) — lotes não, os bens já
nasceram tombados.

**1ª fatia**: locais, categorias, entrada em lote com tombamento sequencial por local e inventário
periódico com folha de conferência. O código do local não pode ser editado depois de criado, porque
já compõe o tombamento dos bens.

**2ª fatia entregue** — o módulo está completo:

- **Transferência com aceite**: o pedido nasce PENDENTE e **o bem não sai do lugar até o destino
  aceitar** — até lá continua contando na origem, inclusive em inventário. Recusa deixa tudo como
  estava. O tombamento **não muda**: ele nasceu do local de origem e acompanha o bem para sempre.
- **Baixa formal** com motivo (quebrado, doado, extraviado, leilão, outro) e observação. O bem vai
  para BAIXADO, some das listagens ativas e do inventário, e permanece no histórico com quem
  registrou. **Não há estorno de baixa** — não foi modelado e não inventei.
- **Trava por inventário aberto**: não se transfere, aceita nem dá baixa em bem cujo local está em
  contagem. Mexer no acervo no meio do inventário mudaria a lista de esperados debaixo de quem está
  conferindo. Vale para a origem (ao enviar) e para o destino (ao aceitar).
- **Um bem tem no máximo uma transferência pendente**, e bem com transferência pendente não recebe
  baixa: resolve-se a transferência primeiro.

**Limitação conhecida**: qualquer usuário com `assets:write` aceita ou recusa qualquer
transferência — não existe vínculo entre usuário e local no modelo, então o sistema não sabe quem
"é do destino". Na prática o patrimônio da prefeitura é operado por poucas pessoas; se virar
problema, exige modelar responsável por local.

## Módulo Almoxarifado / Alimentação Escolar (modelado, não implementado)

N almoxarifados por prefeitura; locais vinculados a um almoxarifado. Tipos de estoque
personalizáveis. Remessa (código pesquisável) → lotes (validade opcional). Produto é agregador de
saldo entre lotes/remessas. Planilha de entrada: ID, NOME, UNIDADE, QUANTIDADE, DATA_VALIDADE.
Solicitação com **reserva com expiração configurável** (liga/desliga + prazo — aqui expira sozinha,
diferente de Processos). Na liberação o responsável vê o saldo que a unidade já possui e decide a
quantidade; saída por lote **FEFO sugerido com ajuste manual**, multi-remessa discriminada.
**Validade só alerta, nunca bloqueia.** Unidade **confirma recebimento** (pode divergir).
Consumo item a item + declaração periódica. **Devolução com aceite** do almoxarifado.
Papel NUTRICIONISTA solicita pelas unidades do seu almoxarifado. Extras: transferência entre
almoxarifados, ajuste de estoque com motivo, relatórios de consumo (PNAE). Comprovante documental
em cada etapa via `documento_emitido`.

## Timbre e impressão

- O timbre da prefeitura (cabeçalho, rodapé, logomarca) é configurado **só pelo painel do produto**
  (`/admin`), nunca pelo ADMIN da prefeitura — é identidade visual do contrato, não cadastro
  operacional.
- **Logomarca é arquivo**, não texto: sobe por upload, fica no MinIO junto com os anexos e desce
  em streaming pela API. Ninguém digita caminho de storage à mão, e o bucket continua privado.
- **A impressão reaproveita a tela de detalhe.** Não existe um segundo layout do documento: o que
  o servidor vê na tela é o que sai no papel, dentro da folha timbrada. Diverge menos e evita
  manter duas versões do mesmo conteúdo.
- Prefeitura sem timbre configurado **imprime assim mesmo**, com aviso de que falta configurar —
  travar a impressão por causa de identidade visual seria pior que o documento sem brasão.
- Ainda **não é documento emitido**: não há registro em `documento_emitido`, código verificador nem
  QR. Isso continua no roadmap.

## Lobby

- O hub mostra **todos** os sistemas, sempre. O que o usuário não pode abrir aparece travado, com
  cadeado e o motivo — módulo não contratado pela prefeitura ou perfil sem acesso. Esconder dava a
  impressão de produto incompleto; travado, o usuário entende que existe e sabe a quem pedir.

## Paginação

- **Envelope `{ itens, total, pagina, porPagina }`**, não array com `X-Total-Count`: o total fica
  visível no JSON, fácil de depurar, e o cliente HTTP não precisa ler cabeçalho.
- **Só as listas que crescem sem teto.** Cadastro pequeno segue array puro. A regra prática: se a
  prefeitura pode chegar a centenas de linhas, pagina; se são dezenas, não.
- **Padrão 25 por página, teto 100.** O teto existe para o cliente não pedir a tabela inteira e
  derrubar a memória do processo.
- **Página começa em 1** e some da URL quando é a primeira — link limpo e um endereço só para a
  primeira página. Trocar o filtro volta para a página 1 (o formulário GET não reenvia `pagina`).
- **Formulário de seleção não pagina**: usa o modo "todas as páginas". Esconder opção de `<select>`
  é pior que uma ida a mais ao banco.
- **Contagem agregada é da API.** Alerta de fila ou de pendências fala do conjunto todo; contar no
  cliente passaria a contar só a página, e a tela que existe para alertar mostraria menos do que a
  realidade.

## Rate-limit

- **Duas camadas**: login apertado (força bruta é o risco real) e teto geral folgado (laço acidental
  no front, cliente automatizado). Ataque distribuído se resolve na borda, na Cloudflare — não aqui.
- **Chave do login é IP + identificador**: travar mil senhas de um usuário trava aquele usuário;
  varrer mil usuários do mesmo lugar trava aquele lugar. Acerto de senha não consome cota, então
  uso legítimo nunca esbarra no limite.
- **Teto geral por usuário autenticado**, aplicado depois do `authenticate`. A API só é acessível
  pelo container do Next, logo o IP do socket é sempre o mesmo e não distingue ninguém.
- **Contador em memória.** Não há Redis no projeto e a API roda em um processo só. Se um dia
  escalar para mais réplicas, cada uma passa a contar a sua parte — aí o limite efetivo vira
  `n × limite` e a decisão precisa ser revista.

## Documentos emitidos (levantamento consolidado)

Base: cinco peças do sistema legado — Termo de Autorização, Despacho do Fiscal do Contrato,
Relatório da Controladoria e duas Ordens de Serviço/Fornecimento (São Bernardo/MA e Alto
Parnaíba/MA). Todas seguem a mesma anatomia: timbre, título em caixa alta, corpo com dados do
processo interpolados, local e data por extenso, bloco de assinatura com cargo ou setor.

**Observação que orientou o desenho**: as duas ordens de serviço são o *mesmo tipo de documento*
em prefeituras diferentes e têm layouts que não se parecem — São Bernardo usa uma tabela corrida
de itens, Alto Parnaíba usa um formulário em seções numeradas com três colunas de assinatura.
Documento oficial é identidade do órgão, não do produto.

### Decisões

- **Cada módulo tem modelo predefinido, editável pela entidade.** O padrão não é texto no
  código-fonte: é linha no banco com `orgao_id` nulo — o **modelo global**, mantido pelo painel do
  produto. A prefeitura que precisa de outra redação edita e passa a ter uma linha própria, que
  vence sobre a global; quem não mexeu continua seguindo o global.
  *Por que não constante no código*: poluiria o fonte com texto jurídico e exigiria deploy para
  corrigir vírgula. *Por que não copiar o global para cada prefeitura na criação*: um erro de
  redação viraria correção prefeitura por prefeitura, com script de migração para as já
  cadastradas. Com resolução por fallback, é um `UPDATE` só.
- **"Restaurar padrão" é apagar a linha da prefeitura.** Sem campo de controle, sem cópia de volta.
- **Prefeitura nova já nasce com todas as peças funcionando**, sem etapa de implantação.
- **O que torna o documento dela é o timbre**, não o texto: brasão, cabeçalho e rodapé já vêm do
  `orgao_documento_config`. Por isso um corpo compartilhado atende a maioria, e a edição fica
  reservada a quem realmente tem redação própria — como as duas ordens de serviço do levantamento.
- **A emissão é um botão, nunca automática.** O servidor decide quando emitir, na tela do processo,
  da ordem, do bem. O sistema não impõe a sequência de peças. Consequência aceita: nada garante que
  a peça obrigatória exista — instruir os autos continua sendo responsabilidade de quem conduz.
- **O documento guarda o retrato, não o arquivo.** Na emissão, `documento_emitido` grava o corpo já
  interpolado e um JSON com os dados usados. A peça é remontada sempre a partir desse retrato: sai
  igual hoje e daqui a cinco anos, sem guardar PDF no storage. **Editar um modelo — global ou da
  prefeitura — vale só para emissões novas**; documento já emitido nunca muda.
  *Por que não renderizar dos dados atuais*: a peça que alguém assinou em março sairia diferente em
  agosto se o contrato, o item ou o modelo mudassem, e a página de conferência atestaria uma versão
  que não é a do papel.
- **Assinatura em duas camadas.** Rodapé com autoria registrada (nome, cargo, matrícula, data e
  hora) + código verificador + QR apontando para página pública de conferência, mantendo a linha
  de assinatura à mão do legado. Certificado digital (ICP-Brasil/gov.br) fica fora — é projeto à
  parte, com custódia de certificado e custo por assinatura.
- **O código verificador é global**, não por prefeitura: a página de conferência é pública e não
  tem tenant na URL. Sorteado, não sequencial — código adivinhável deixaria varrer os documentos
  de todas as prefeituras.
- **Marcador desconhecido é erro na emissão**, não campo vazio. Documento oficial com lacuna em
  branco é pior que documento que não saiu.

### Modelo de dados (a implementar)

`documento_modelo` (novo):

| Coluna | Observação |
| --- | --- |
| `orgao_id` | **Nulo = modelo global**, mantido pelo painel do produto |
| `modulo`, `tipo` | PROCESSOS/PATRIMONIO/FROTAS/ALMOXARIFADO + o tipo da peça |
| `nome` | Rótulo que aparece no botão de emissão |
| `corpo` | Texto com marcadores |
| `ativo` | Prefeitura pode desligar uma peça que não usa |

Único parcial por (`orgao_id`, `tipo`) e um único global por `tipo` onde `orgao_id IS NULL` —
duas linhas globais do mesmo tipo tornariam a resolução ambígua.

`documento_emitido` (existe, a estender): ganha `modelo_id`, `corpo` (texto já interpolado),
`dados` (JSONB), `emitido_por_usuario_id` e a autoria congelada em texto (`emitido_por_nome`,
`emitido_por_cargo` — o servidor pode mudar de cargo depois). A coluna `arquivo` deixa de ser
obrigatória: não há arquivo. `codigo` passa a ser único global, não por órgão.

### Marcadores previstos

Órgão (`{{orgao.nome}}`, `{{orgao.cnpj}}`, `{{orgao.municipio}}`), processo (protocolo, número
administrativo, tipo, data de abertura), contrato (número, objeto, vigência, fiscal), fornecedor
(razão social, documento, endereço), ordem (empenho, requisição, projeto/atividade, elemento de
despesa, fonte, parcelas, nota fiscal), itens (tabela), totais (`{{valorTotal}}`,
`{{valorTotalPorExtenso}}` — as duas ordens trazem o valor escrito por extenso), data
(`{{data.porExtenso}}` no formato "segunda-feira, 24 de agosto de 2026") e autor.

### Fatiamento

1. **Feito.** Motor: migration `0014`, resolução global → prefeitura, marcadores validados,
   emissão com retrato, página pública de conferência com QR. Só o módulo Processos.
2. **Feito.** Migration `0015` com os sete tipos do catálogo, tela de edição pela prefeitura
   (marcadores ao lado, pré-visualização, "restaurar padrão") e `/admin/modelos` para o produto
   manter os padrões.
3. **Pendente.** Demais módulos: como o motor é genérico, entra modelo global novo por
   migration — sem código.

## Solicitação por unidade

- **Lotação de unidade prende o pedido à unidade.** Lotação de setor não prende: compras e
  protocolo atendem várias unidades, e travá-los quebraria o trabalho que já fazem hoje.
- **Contrato só aparece para a unidade a que foi destinado** (`contrato_unidade`). O vínculo estava
  modelado desde o começo e nunca era consultado — a tela prometia o filtro e não o aplicava.
- **A regra vale na API, não só na tela.** Quem chama a API direto consumiria saldo de contrato de
  outra unidade.
- **Contrato antes dos itens.** Nada de listar item de contrato que o usuário nem escolheu:
  a montagem é unidade → contrato → itens.

## Documento criado pela prefeitura

- **`escopo` separado de `tipo`.** O escopo (processo, processo+contrato, ordem, solicitação) diz
  de onde a peça fala e determina marcadores e busca de dados; o tipo é só a identidade. Sem essa
  separação, peça nova exigiria código — era o `tipo` que decidia tudo.
- **O escopo é escolhido na criação e não muda depois.** Trocá-lo invalidaria os marcadores já
  escritos no corpo e, pior, mudaria silenciosamente o significado de peças já emitidas naquele
  modelo.
- **O identificador sai do nome** ("Termo de recebimento" → `TERMO_DE_RECEBIMENTO`), com conflito
  barrado contra o global e contra os da própria prefeitura.
- **Personalizada exclui; padrão restaura.** Peça criada pela prefeitura não tem texto de fábrica
  atrás — restaurar não faz sentido e excluir é o caminho. Já a personalização de um modelo
  existente sempre pode voltar ao padrão.

## Auditoria

- **Só o ADMIN da prefeitura lê a trilha.** É registro de conduta de cada servidor, em todos os
  módulos — ver o trabalho alheio não é atribuição de gestor nem de controladoria.
