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
  NUTRICIONISTA, UNIDADE, PATRIMONIO, FROTAS) + overrides pontuais em `usuario_permissao`,
  que passaram a valer. Ver "Níveis de acesso" adiante.
- **Login sem CNPJ**: identificador (e-mail OU username) + senha; ambos únicos globalmente; o órgão
  vem do registro. Se surgir usuário em 2+ prefeituras, evoluir para conta global + `usuario_orgao`.
- **Lotações múltiplas**: usuário tem N lotações, cada uma apontando para exatamente um destino
  (unidade OU setor OU departamento). Toda ação registra em nome de qual lotação foi feita.
- **Duas hierarquias paralelas**: Unidades (secretarias — consomem: recebem contratos, solicitam) e
  Setores funcionais (processam: Protocolo, Compras, Controladoria, Alimentação Escolar...).
  Departamento pertence a setor e é endereçável no fluxo (fila própria).
- **Auditoria**: só eventos de negócio (despacho, parecer, cancelamento, aprovação, mudança de
  setor) — não toda edição de cadastro. **Implementado**, com tela em `/processos/auditoria`.
- **Numeração**: sequencial/ano com sequências separadas por tipo (`numeracao_sequencia`):
  protocolo 000123/2026, processo adm 048/2026, ordem 0001/2026.
- **Documentos emitidos**: todo módulo gera comprovantes/declarações/relatórios via
  `documento_emitido`, com código pesquisável que vira QR interno. Timbre/logomarca por prefeitura
  em `orgao_documento_config`. **Implementado** — motor, modelos por módulo, rascunho editável
  e conferência pública.
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

## Almoxarifado — decisões após ler o legado (consolidado)

Leitura completa do sistema antigo em `legado-almoxarifado.md`. As decisões
abaixo revisam ou confirmam o levantamento original, e **valem sobre ele** onde
divergirem.

1. **N almoxarifados por prefeitura**, com locais vinculados a um — confirmado,
   ainda que o legado nunca tenha usado a tabela dele. Transferência entre
   almoxarifados continua no escopo.
2. **Tipo de estoque é categoria dentro do almoxarifado**, cadastrável pela
   prefeitura: o almoxarifado separa por secretaria, o tipo separa alimentação,
   limpeza e expediente. A solicitação filtra por ele.
3. **Produto é catálogo GLOBAL**, compartilhado entre prefeituras, como
   `fornecedor`. "CORANTE NATURAL / KG" é o mesmo item em qualquer município, e
   o legado já tratava assim com `UNIQUE (nome, und_medida)`. Sem `orgao_id`.
4. **Quantidade é decimal.** O legado usa `integer` e não representa 2,5 kg de
   arroz — para alimentação escolar isso não é formatação, é o dado.
5. **O lote sobrevive à entrega.** A unidade guarda lotes com validade própria,
   não um saldo agregado por produto: a escola precisa saber o que vence
   primeiro no armário dela, e o consumo baixa em FEFO. Corrige uma lacuna do
   nosso UML original, que o legado acertava.
6. **Reserva no envio, no banco, dentro da transação.** Rascunho não reserva
   nada. O prazo de expiração é configurável pela prefeitura, e **a liberação
   baixa a reserva junto com o saldo** — no legado a reserva vivia no Redis com
   TTL fixo e nunca era baixada, deixando material reservado e debitado ao mesmo
   tempo por até 48h.
7. **Recebimento a menor vira perda, com motivo obrigatório.** A diferença entre
   liberado e confirmado sai do estoque como quebra, não volta ao almoxarifado.
   O total da prefeitura diminui e a perda fica rastreável até quem recebeu.
8. **Quem solicita segue a regra de Processos**: lotação de unidade só pede pela
   unidade dela, lotação de setor escolhe qualquer uma. Sem vínculo novo entre
   usuário e tipo de unidade.
9. **Base nova, sem migração de movimento.** Só cadastros (unidades, produtos)
   são trazidos. O histórico do legado tem campos que não fecham —
   `qnt_entrada` contando linhas em vez de itens, saldo que pode ir a negativo —
   e carregá-lo importaria o problema junto.
10. **Registro de qualidade do lote fica para depois.** Existe no legado
    (`qualidade_produto_estocado`), não entra agora; o ajuste de estoque com
    motivo já cobre o caso urgente.

### Fatiamento

**1ª fatia — ciclo completo até o recebimento**, que é o que substitui o legado:
almoxarifados, tipos, remessa com importação de planilha, lotes com validade,
solicitação com reserva, liberação FEFO ajustável e confirmação da unidade com
perda registrada.

Ficam para depois: consumo item a item e declaração periódica, devolução com
aceite, transferência entre almoxarifados, ajuste de estoque e relatórios do
PNAE.

### Regras que o legado ensinou pelo erro

Cada uma vira teste antes de virar código:

- Liberação é **uma transação só**. No legado são N inserts e updates soltos:
  uma falha no meio deixa saldo debitado sem lote de destino.
- Reserva e disponibilidade têm de olhar **o mesmo escopo**. No legado a reserva
  era por unidade e a disponibilidade somava o órgão inteiro, então duas
  unidades pedindo o mesmo produto não se enxergavam.
- **Consumo nunca deixa saldo negativo** — o legado subtrai sem conferir.
- **FEFO em todas as consultas**, não só na liberação: no legado duas das três
  ordenam por validade decrescente e mostram primeiro o que vence por último.
- Nada de endpoint de exclusão em massa por órgão ou unidade.

### Comprovante

Usa o motor de `documento_emitido`, com escopo novo por peça. O legado gera um
número aleatório de 7 a 12 dígitos sem unicidade garantida; o nosso já tem
código verificador único no produto, conferência pública e cancelamento sem
apagar.

## Módulo Almoxarifado / Alimentação Escolar (levantamento original)

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
- A solicitação **passou a ser documento emitido** (escopo `SOLICITACAO`), com código verificador
  e QR. A tela de impressão direta continua existindo, para quem só quer o papel.

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
3. **Feito.** Patrimônio, frotas e almoxarifado, por migration. O motor era genérico; o que
   faltava era o **escopo** — de onde a peça fala.
4. **Feito.** Rascunho editável antes de emitir, peça restrita a setor, e o relatório de
   consumo como escopo próprio.

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

## Módulo Protocolo Externo (levantamento consolidado)

Porta de entrada para quem não é servidor: cidadão, fornecedor ou outro órgão. O modelo já previa
isto desde a migration 0001 — `requerente`, `processo.requerente_id`, `tipo_processo =
ATENDIMENTO_EXTERNO` e anexo enviado por requerente existem e nunca foram usados.

### Decisões

- **Duas portas de entrada.** Balcão (servidor do protocolo atende presencialmente) **e** página
  pública onde o próprio cidadão abre requerimento. O balcão continua sendo o caminho de quem
  chega na prefeitura; o portal alcança quem não vai até lá.
- **Assunto é lista configurável pela prefeitura**, com o setor que resolve amarrado a cada um.
  O processo nasce direto no setor certo, sem triagem manual, e dá para dizer quantas certidões
  foram pedidas no mês. Lista fixa no sistema não serve: prefeitura nenhuma atende o mesmo que a
  outra.
- **Acompanhamento por protocolo + documento** (CPF/CNPJ) em página pública. Os dois juntos
  existem para impedir que alguém varra protocolos sequenciais e leia pedido alheio — o número
  sozinho é adivinhável por construção.
- **A consulta pública mostra andamento, não os autos.** Situação, setor atual, datas e as
  exigências dirigidas ao requerente. Despacho interno, parecer e anexo de servidor ficam de fora:
  são peças de trabalho da administração, não resposta ao cidadão.
- **O requerente acompanha, anexa documento e responde exigência.** O setor registra a exigência
  com prazo; enquanto pendente, o processo fica visivelmente parado esperando o cidadão — não é o
  servidor que está devendo resposta.
- **Comprovante de abertura é documento emitido**, pelo motor que já existe: escopo novo
  `PROTOCOLO`, modelo global editável pela prefeitura, com QR que leva à consulta pública.

### Riscos assumidos, com as contramedidas

| Risco | O que fazemos |
| --- | --- |
| Abertura pública vira spam | Limite por IP na abertura, além do teto geral |
| Upload público de arquivo malicioso | Lista de tipos aceitos, teto de tamanho, storage privado (nunca servido direto) |
| Varredura de protocolos | Consulta exige documento; limite por IP; resposta idêntica para inexistente e documento errado |
| Dado pessoal exposto | A consulta devolve só o que é do próprio requerente; nada de terceiros, nada de peça interna |

### Fatiamento

1. **Balcão e consulta.** Assuntos configuráveis (com setor destino), abertura pelo servidor do
   protocolo, requerente cadastrado no atendimento, comprovante emitido e consulta pública por
   protocolo + documento.
2. **Abertura pelo cidadão.** Formulário público, com as contramedidas de abuso.
3. **Exigência e resposta.** Setor pergunta com prazo, requerente responde e anexa; processo
   sinaliza que está parado esperando o cidadão.

### Portal do cidadão — decisões da 2ª fatia

- **Sem listagem de prefeituras.** O portal é acessado pelo CNPJ no endereço, divulgado pela
  prefeitura. Uma lista pública entregaria a carteira de clientes do produto.
- **Freio no portal, nunca no balcão.** Presencial tem um servidor conferindo quem está na frente
  dele; travar o atendimento seria pior que o abuso.
- **Limite por documento além do limite por IP.** Um sozinho não segura: IP se troca, e CPF válido
  não é infinito.
- **Armadilha responde sucesso.** Dizer ao robô que ele foi detectado só ensina a contornar.
- **A resposta pública não devolve id interno.** Na rua o que vale é o protocolo.

### Exigência — decisões da 3ª fatia

- **Uma pendente por processo**, por índice único parcial. Mais de uma pergunta aberta confunde os
  dois lados.
- **Prazo congelado na criação.** Alterar a configuração depois não retroage sobre quem já foi
  notificado.
- **Credencial por chamada, sem sessão para o cidadão.** Protocolo + documento a cada ação: menos
  superfície, sem expiração nem recuperação de acesso para manter.
- **Protocolo concluído é porta fechada.** Documento enviado ali não seria lido por ninguém.
- **Resposta antes do anexo**, no envio: falha no upload não pode fazer o cidadão perder o texto.
- **Cancelar exigência exige motivo** e fica na trilha — desistir de uma exigência é ato que
  precisa de explicação, como qualquer outro.

### Protocolo como módulo próprio

- **Contratável em separado.** Prefeitura pode ter protocolo sem processos, e vice-versa.
- **O balcão não vê processos.** O papel perdeu `READ_ONLY` inteiro; a função dele é o atendimento.
- **Detalhe do atendimento vive no protocolo**, não na fila de processos — senão o atendente
  perderia de vista o que abriu.
- **Exigir é do setor que analisa, não do balcão.** O atendente vê a exigência e a resposta, mas
  quem pergunta é quem está resolvendo o pedido.
- **`/cidadao` para o público, `/protocolo` para o balcão.** Os dois nomes dizem para quem a tela
  é; usar o mesmo caminho para os dois confundiria a rota pública com o sistema interno.

## Documento editável: a revisão fica antes da emissão

**Pedido do cliente:** poder ajustar texto e datas do documento gerado.

**Decisão:** a peça nasce em **rascunho** e é editável até ser emitida. Depois
de emitida, o corpo é imutável — só resta cancelar e preparar outra.

**Por quê.** O documento emitido guarda o retrato e responde por um código
verificador único no produto, publicado em `/conferencia/{codigo}`. Editar
depois faria a conferência mentir: o TCE abriria o código e veria texto
diferente do papel assinado que circulou. A garantia inteira do motor de
documentos depende disso.

**Como fica:**

- Emitir passou a ter duas etapas. O botão **prepara** a peça; a tela abre com
  o texto editável; **Emitir documento** carimba a data e libera a conferência.
- O código é sorteado já no rascunho, porque o corpo o imprime e o QR o carrega.
  Rascunho abandonado consome um código — é barato, e a alternativa seria
  remendar o texto que o usuário acabou de revisar.
- `corpo_original` guarda o texto do modelo. Dá para comparar o que mudou e para
  voltar atrás com um clique.
- O rascunho é **de quem o preparou**: a peça leva o nome e o cargo do autor
  impressos, e deixar outro servidor reescrevê-la poria a assinatura de um sobre
  as palavras de outro.
- Rascunho se **descarta**; o que já circulou se **cancela**. São atos
  diferentes e o banco recusa a confusão.

**Editor: `contenteditable`, não Lexical.** A Ordem de Serviço é toda tabela,
com `colspan` e `style="width: 22%"` em quase toda célula. Lexical e ProseMirror
convertem o HTML de entrada para um estado interno e o devolvem re-serializado —
esses atributos se perdem sem uma extensão escrita para cada um. Para "trocar
uma data", o custo não se paga, e o documento sairia deformado sem ninguém
pedir. Com `contenteditable` o HTML é o próprio estado. Quem decide o que pode
ficar continua sendo `limparCorpo`, o mesmo sanitizador do modelo — e a colagem
entra como texto puro, para o usuário não ver uma formatação na tela e outra
depois de salvar.

## Níveis de acesso: papéis enxutos e a API decidindo

**Problema:** com cinco módulos no ar, os papéis viraram uma confusão. A
nutricionista enxergava a frota; quem recebe material na escola só podia ser
SERVIDOR, papel que dá contratos, licitações e processos da prefeitura a uma
diretora que precisa pedir arroz.

**A causa** era uma lista `READ_ONLY` herdada por quase todo papel, carregando
frotas, licitações, contratos, fornecedores e processos. Fazia sentido quando o
produto era um sistema só; com cinco módulos, virou passe livre.

**O que era pior que o sintoma.** As 41 permissões existiam apenas no web, para
esconder botão. Na API havia `resolveTenant(modulo)` — que confere se a
prefeitura contratou o módulo — e `exigirPapel` em 40 das ~219 rotas. Nas
outras, a regra real era "tem sessão e a prefeitura tem o módulo": bastava
chamar a rota direto para passar por cima da tela.

### Decisões

1. **A matriz vive na API** (`domain/shared/Permissoes.ts`) e é a autoridade.
   O web a espelha para esconder o que o usuário não pode; um teste recusa
   qualquer divergência entre os dois lados.
2. **Nenhuma herança entre papéis.** Cada papel lista o que aquele cargo faz. A
   repetição é deliberada: é o que permite ler uma linha e saber o alcance dela.
3. **Toda rota declara a permissão que exige.** Cada router tem um piso
   (`router.use(exigirPermissao(...))`) e as ações de escrita declaram a sua.
   Um teste recusa arquivo de rotas sem piso, e outro recusa permissão que não
   exista no catálogo — erro de digitação numa guarda a tornaria impossível de
   satisfazer, recusando até o ADMIN.
4. **Papel novo: `UNIDADE`.** A escola, a creche, o posto. Pede, confirma o que
   chegou, registra consumo, devolve a sobra e imprime o comprovante. O papel
   abre a porta; a lotação diz de qual armário se fala — `SolicitarEstoque` já
   limita quem tem lotação de unidade ao local dela.
5. **`usuario_permissao` passou a valer.** Existia desde a 0001 e nunca havia
   sido lida. É a válvula para o caso que não cabe em papel nenhum, e **revoga**
   além de conceder: tirar acesso de alguém é tão necessário quanto dar. Vem do
   banco a cada requisição, não do token — revogar não pode esperar as oito
   horas de validade do JWT.

### Alcance de cada papel, depois da revisão

| Papel | Alcança |
| --- | --- |
| ADMIN | tudo que a prefeitura contratou |
| GESTOR | contratação, cadastros, todos os módulos operacionais — menos a auditoria |
| COMPRAS | fornecedor, licitação, contrato, ordem de fornecimento |
| CONTROLADORIA | leitura para parecer, e a auditoria |
| SERVIDOR | solicitação e acompanhamento do trâmite |
| PROTOCOLO | só o balcão |
| NUTRICIONISTA | almoxarifado inteiro, e nada de frota, patrimônio ou licitação |
| UNIDADE | o ciclo do material da própria unidade |
| PATRIMONIO | bens, tombamento, inventário |
| FROTAS | veículos, motoristas, viagens |

A auditoria ficou com ADMIN e CONTROLADORIA — é a conduta dos próprios
servidores, e quem é auditado não escolhe o que aparece.

## Documento por setor, encerrados na fila e a segunda logomarca

### Documento amarrado ao setor

Três recortes passam a conviver: o **global** do produto, o **da prefeitura**
(que já existiam, resolvidos por `orgao_id`) e agora o **do setor** — o parecer
que só a controladoria emite, a ordem que só compras emite.

**O vínculo é com o tipo do setor, não com a linha da tabela `setor`.** Um
modelo global tem `orgao_id NULL` e precisa valer em toda prefeitura; apontar
para o setor de Compras de um município o deixaria inútil nos demais. O tipo
(`COMPRAS`, `CONTROLADORIA`…) é o mesmo vocabulário em todas.

**"Cargo" ficou sendo o setor da lotação, não o papel.** O processo tramita
entre setores, e é lá que a peça nasce: um servidor com papel `SERVIDOR` lotado
em Compras emite a ordem; o mesmo papel na escola, não.

**Restringe de verdade.** Sem setor marcado, a peça vale para todos — é o que
mantém no ar os 20 modelos semeados antes da 0027. Com setores, ela some da
lista de quem não é deles. O filtro acontece na consulta, e não depois: quem
está de fora recebe o mesmo "não há modelo" de um tipo inexistente, sem ficar
sabendo que existe um parecer que não pode emitir.

Só a versão da prefeitura aceita restrição. Restringir o modelo global mudaria
a regra de todas as outras prefeituras de uma vez.

### Processos encerrados

O corte não é "está aqui agora" — processo encerrado não está em setor nenhum, e
filtrar por `setor_atual_id` devolveria lista vazia para todo mundo. É **passou
por aqui**: existe despacho daquele setor no processo. Quem atuou numa etapa
continua alcançando o processo depois de ele sair de circulação, e quem nunca
atuou não passa a ver o dos outros.

Ficou como aba na própria fila, não como tela nova: o servidor procura onde já
está acostumado.

### Segunda logomarca

O timbre tinha uma imagem só, à esquerda. Prefeitura costuma imprimir duas — o
brasão do município de um lado, a marca do programa ou da secretaria do outro
(FUNDEB, PNAE, "Governo do Estado").

Cada lado tem vida própria: trocar um não apaga o outro, salvar o texto do
timbre não apaga nenhum, e excluir tira só o lado pedido. Ao remover, o registro
sai antes do objeto no storage — a ordem inversa deixaria o timbre apontando
para um arquivo que já não existe, e a folha sairia com imagem quebrada.

## Correção: o organograma é vocabulário, não administração

Ao apertar os papéis, joguei `units:read` e `sectors:read` no bloco de
administração da prefeitura. COMPRAS e CONTROLADORIA passaram a entrar em
Processos e a tela morria com 403 — a fila precisa escrever o nome do setor ao
lado do processo, e a solicitação precisa oferecer a unidade.

**Não é o `READ_ONLY` de volta.** Aquela lista carregava frotas, licitações,
contratos e processos: dados de outros módulos, e era o que fazia a
nutricionista enxergar a frota. `units:read` e `sectors:read` devolvem `id`,
`nome` e `ativo` da própria prefeitura — o organograma, que toda tela de todo
módulo precisa nomear. Escrever continua sendo administração.

Na mesma passada, `PATRIMONIO` ganhou `suppliers:read`: a entrada de bens
registra de quem veio o bem. Ler o cadastro não é conduzir a contratação —
`suppliers:write`, licitação e contrato seguem de fora.

### O teste que faltava

O erro não aparecia em teste nenhum: o web escondia botão certo, a API guardava
rota certo, e ninguém conferia se as duas coisas cabiam na mesma tela.
`telas-alcancaveis.test.ts` amarra as três pontas — a permissão que a página
exige para abrir, as rotas que ela chama e a permissão de cada rota — e falha
quando algum papel abre a tela e levaria 403 no meio.

Ele achou mais três buracos além do relatado: patrimônio e fornecedor, e o
detalhe do processo buscando fluxo e exigências sem tolerar a falta.

**Busca acessória não conta.** A tela tem duas formas legítimas de conviver com
a falta de uma permissão, e o código já usava as duas: perguntar antes
(`viewer.can("x") ? consulta() : []`) ou tolerar a falha (`.catch(...)`). Nos
dois casos ela abre inteira, com menos informação — que é o certo para o que é
complementar. Sem essa distinção o teste exigiria dar a permissão, e o jeito
mais fácil de calar um teste de acesso é abrir o acesso.

## Relatório de consumo (PNAE)

A 2ª fatia do almoxarifado passou a registrar consumo, perda e devolução por
unidade. O dado existia e nenhuma tela o lia — quem presta contas ao FNDE
refazia a conta na planilha, a partir dos comprovantes impressos.

**Movimento físico, em quantidade.** Valor ficou de fora por decisão: a entrada
da remessa registra quantidade e não tem preço, e um custo médio inventado aqui
produziria número indefensável diante do conselho de alimentação escolar. Quando
o preço entrar no almoxarifado — na entrada do lote ou herdado do contrato —, o
relatório passa a valorar sem mudar de forma.

### As quatro grandezas, e de onde cada uma vem

| Grandeza | Origem | Por quê |
| --- | --- | --- |
| Recebido | `liberacao_lote.quantidade_confirmada` | O que a escola **confirmou**, não o que o almoxarifado despachou — contar o despachado infla o relatório com o que se perdeu no caminho |
| Perdido | `liberacao_lote.quantidade_perdida` | Sempre com motivo: o banco recusa perda sem ele |
| Consumido | `consumo` | O que a unidade declarou usar |
| Devolvido | `devolucao` com status `ACEITA` | Pendente não voltou ao saldo de ninguém; recusada nunca voltará |

**O corte é pela data da confirmação**, não da liberação: material despachado em
março e conferido em abril é movimento de abril, que é quando a escola assumiu a
responsabilidade por ele.

**`FULL JOIN` entre as três origens.** Uma escola pode ter consumido sem receber
no período (usou o que já estava no armário), ou devolvido sem consumir. Um
`LEFT JOIN` a partir de qualquer uma perderia essas linhas — e omitiria
justamente a escola cujo movimento chama atenção.

### Agricultura familiar

`fornecedor` ganhou `agricultura_familiar`. É atributo do fornecedor, não da
compra: uma cooperativa de agricultores é a mesma em qualquer município, e por
isso cabe no cadastro **global**. Toda alteração continua passando por
`fornecedor_historico`.

O percentual sai **por número de remessas**, e a peça diz isso na própria folha.
Os 30% que o FNDE cobra são financeiros; sem preço no estoque, apresentar este
número como se fosse aquele seria mentira impressa em papel timbrado.

### O relatório como entidade

O motor de documentos emite por referência a uma entidade, e um relatório de
período não tinha nenhuma. `relatorio_consumo` é essa entidade: guarda o
**recorte** — almoxarifado, tipo de estoque, período — e nada mais.

Os números são apurados na leitura. A peça emitida sobre o relatório congela o
resultado em `documento_emitido.dados`, como toda peça do sistema. É o que faz a
divisão valer: o relatório aberto acompanha o estoque de hoje, e o documento
guarda o que era verdade no dia em que saiu — com código de conferência, para o
conselho poder validar meses depois.

## Importação de planilha: o usuário declara as colunas

**Problema relatado:** "por existir diversas variantes, a importação pode
ocorrer incorretamente".

O sistema adivinhava. Procurava um cabeçalho conhecido e, quando não achava,
assumia uma ordem fixa. As planilhas das prefeituras variam demais — uma tem
"item nº" na frente, outra tem observação no meio, outra põe o valor antes da
quantidade. Quando o palpite errava, os dados entravam **em silêncio**: sem
erro, sem aviso, e o usuário só descobria no documento impresso.

Havia até uma incoerência plantada: a ordem posicional dos itens de contrato
listava `quantidade` antes de `marca`, e o tipo declarava o contrário.

**Agora são duas etapas.** Cola, diz o que é cada coluna, importa. A prévia
mostra as primeiras linhas sob os rótulos escolhidos — é conferindo o conteúdo
embaixo do nome que se percebe a coluna trocada. Coluna que não interessa fica
como *ignorar*.

A detecção continua existindo, **rebaixada a sugestão**: quando reconhece o
cabeçalho, oferece a sequência num botão. Aceitar é ato do usuário, e ela exige
duas colunas reconhecidas — uma só é coincidência, e uma linha de dado que
comece com "MATERIAL DE LIMPEZA" casaria com o sinônimo "material".

### Três bugs que os testes desta fatia encontraram

- **`trim()` comia as tabulações.** Estava no código desde o começo, nas duas
  colagens. Numa planilha cuja primeira coluna esteja vazia — item nº em branco,
  coluna de conferência —, `"\tARROZ\t10"` virava `"ARROZ\t10"` e **todas as
  colunas seguintes andavam uma casa**. Agora apara-se só espaço e `\r`: a
  tabulação é dado, ela diz que existe uma célula ali, mesmo vazia.
- **Linha de seção passava por cabeçalho.** "HORTIFRUTI" seguido de células
  vazias era descartado como título. O critério exigia só ausência de dígito nos
  campos numéricos; passou a exigir também que ao menos um deles tenha **texto**
  — senão uma planilha que comece por item de quantidade em branco perderia a
  primeira linha de dado.
- **`Item nº` é lido como produto**, porque `item` é sinônimo legítimo de
  produto em muita planilha. A sugestão erra nesse caso, e não há dicionário que
  resolva — é precisamente por isso que ela é sugestão, com a amostra ao lado.

## Colagem de PDF: extração por âncora

A importação por colunas resolve o que vem do Excel. De um PDF vem outra coisa:
a tabela chega como um **parágrafo só**, sem tabulação e, muitas vezes, sem nem
quebra de linha. Não há coluna para mapear.

O que existe é **tipo**. Número é reconhecível, unidade é uma palavra curta, e o
texto do serviço é tudo que sobra. Então o usuário marca quais campos o texto
traz e em que ordem — a ordem de marcação vira a sequência, e ele reordena com
as setas —, e a extração ancora nos campos reconhecíveis.

**A leitura vai das pontas para o meio.** Os campos antes do texto livre saem do
começo, os de depois saem do fim, e a especificação fica com o intervalo. Ler da
esquerda para a direita exigiria saber onde a descrição termina, que é
exatamente o que não se sabe.

Só pode haver **um campo de texto longo**: com dois, não há como decidir onde um
acaba e o outro começa. A tela recusa.

### Por que a ordem não pode ser adivinhada

No termo de referência real, o cabeçalho dizia `UND QTD` e o dado vinha
`12 Mês` — invertido. Confiar no título gravaria a unidade como quantidade.

### O corte entre itens

A âncora é a numeração (`1`, `1.1`, `2.1`) **precedida de um número**, que é
como todo item termina. Cortar em toda numeração partiria a descrição:
"TELHADOS DE ATÉ 2 ÁGUAS" tem número seguido de texto e não começa item nenhum —
e "COM VALOR ENTRE 1.000.000,01 E 3.000.000,00" também não.

Texto que já vem quebrado em linhas usa as linhas, que são mais confiáveis.

### Bloco incompleto é descartado, nunca meio-preenchido

"1 SERVIÇOS PRELIMINARES 6.263,65" é subtotal de grupo, não item: tem um número
e a sequência pede sete. Importá-lo somaria o mesmo dinheiro duas vezes no total
do contrato. Valor ausente que parece preenchido é pior que a linha faltando.

Número do item, fonte (SINAPI/ORSE) e código não têm coluna no contrato e vão
para a descrição — jogá-los fora perderia a ligação com a planilha orçamentária
aprovada.

## O que ainda não virou código

Revisado em agosto/2026, confrontando cada decisão com o repositório.

### Decidido e ainda ausente

| Decisão | Onde parou |
| --- | --- |
| **Campos extras do contrato** | `contrato_campo_extra` e `item_valor_extra` existem desde a 0002. Nenhuma linha do sistema **cria ou lê** as duas — só há um `DELETE` na limpeza do contrato. É a feature de "colunas extras da planilha" do levantamento, viva só como tabela. |
| **Visibilidade estendida da etapa** | Gravada em `fluxo_etapa`, oferecida no painel de fluxos, nunca lida. |

### A quarta configuração sem efeito

`contrato_campo_extra` entra na mesma família de `dados_contratante`,
`usuario_permissao` e a visibilidade estendida: coisa que o banco guarda e
nenhum código consome. As três primeiras viraram bug quando alguém confiou
nelas. Esta ainda não virou porque a tela nunca a ofereceu — o que significa que
o levantamento prometeu um recurso que o usuário nunca viu.

**Ou se implementa, ou se remove.** Tabela que ninguém lê não é dívida neutra:
é uma promessa pendurada no schema.

## Link externo do fornecedor — implementado

`fornecedor_historico.alterado_por` aceitava `link_externo` desde a 0001, e o
caminho que produziria esse valor nunca existiu: era decisão do levantamento
viva só como comentário numa coluna. Quem digita razão social e endereço hoje é
o setor de compras, copiando de um papel — e ninguém conhece o dado melhor que
o dono dele.

### O token é segredo, e o banco guarda o hash

`fornecedor_convite.token_hash` guarda SHA-256; o token existe em texto **uma
vez**, na resposta que gera o link. Perdido, gera-se outro — e o anterior morre
junto, porque dois links vivos para o mesmo fornecedor tornariam a revogação
inútil (índice único parcial garante isso no banco).

SHA-256 sem sal basta aqui, ao contrário de senha: o token tem 256 bits
sorteados e não é reutilizado. Sal serve contra segredo fraco escolhido por
gente.

### O CNPJ não entra

É a identidade do registro. Deixá-lo editável transformaria o fornecedor em
outro, levando junto o histórico e os contratos de **todas** as prefeituras que
o usam — e o cadastro é global. Fica de fora do tipo do caso de uso e do schema
da rota pública, com teste guardando as duas pontas.

### Três recusas, uma mensagem

Token inexistente, expirado e revogado devolvem exatamente o mesmo erro.
Distinguir contaria a quem tem um link velho que ele existiu, e a quem tenta
adivinhar que chegou perto.

### Prazo de 30 dias, uso repetido

Cobre o vaivém real — o e-mail chega, o responsável está de férias, o contador
procura o cartão CNPJ. O convite **não morre no primeiro uso**: o fornecedor
volta para corrigir o que digitou errado. Link sem prazo seria chave permanente
entregue por e-mail.

### A auditoria fica com quem convidou

O fornecedor é global; a prefeitura que abriu a porta é quem responde pelo
cadastro alterado, e é na trilha dela que a mudança aparece — sem `usuarioId`,
porque quem alterou não tem conta no sistema.

## Registro de qualidade do lote — implementado

Existia no legado (`qualidade_produto_estocado`) e foi adiado no levantamento do
almoxarifado, porque o ajuste de estoque com motivo cobria o caso urgente. O que
faltava era o **acompanhamento**: a caixa que chegou amassada, o lote que vence
semana que vem, a câmara fria que oscilou.

**Opcional em toda parte, e sem mexer em saldo.** Quem tira material do estoque é
o ajuste, que já existe e exige motivo. Misturar as duas coisas faria um relato
de avaria sumir com o material sem ninguém pedir — e, pior, faria quem só quis
anotar hesitar em anotar. É justamente por não movimentar nada que o registro
pode ser livre.

- Aponta para o lote do almoxarifado **ou** para o do armário da unidade, nunca
  os dois: o material está num lugar só. Mesma regra do ajuste.
- Cinco tipos — dano, validade, armazenamento, conformidade, outro. Vocabulário
  curto de propósito: lista longa vira campo que ninguém preenche direito, e o
  texto livre ao lado é quem conta a história.
- **A observação é obrigatória**; a quantidade afetada, não. "Duas caixas
  amassadas" tem quantidade; "a câmara fria oscilou" não tem, e é informação
  igualmente legítima. Já um registro sem texto seria uma linha dizendo que algo
  aconteceu sem dizer o quê.
- Sem guarda de `stock:manage`: a escola que recebeu a caixa amassada é quem a
  vê primeiro. Quem observa é quem registra.

A trava do órgão fica no caso de uso, e o lote é alcançado por join até o
almoxarifado — um id de outra prefeitura não vira registro.

## Acesso por escola no almoxarifado — decidido

Com o módulo no ar, apareceu o buraco: a trava por lotação existia só na
**escrita** — `SolicitarEstoque`, `MovimentarEstoque` e `ReceberEstoque`
comparavam `local.unidade_id` com as unidades da lotação. Toda **leitura**
passava com `stock:read` puro. A escola 1 listava os pedidos, o estoque, o
consumo, as devoluções e os relatórios da escola 2.

A causa é a mesma dos três pontos levantados: **a escola não era um destino de
lotação**. O almoxarifado inteiro fala em `local` — é ele que tem CNPJ,
endereço e responsável —, mas a lotação só sabia apontar para unidade, setor ou
departamento. A ligação era indireta, por um `local.unidade_id` que é nullable,
e por isso frágil nos dois sentidos: local sem unidade não pertencia a ninguém,
e a mesma unidade cobria escolas diferentes.

### A escola vira lotação

`lotacao` ganha `local_id` como quarto destino, mantendo o CHECK de exatamente
um. Nada de campo novo em `usuario`: um segundo mecanismo de vínculo ao lado da
lotação criaria dois lugares para procurar a mesma resposta, e a auditoria de
processos já registra em nome de qual lotação o usuário agiu.

### O alcance, e quem escapa dele

- **Lotado numa escola** alcança aquela escola, e só ela — em pedidos, estoque,
  consumo, devolução, qualidade, ajuste e relatórios.
- **Lotado num setor** alcança os locais atendidos pelos almoxarifados **do seu
  setor**. Para isso `almoxarifado` ganha `setor_id`: o central é do setor de
  Compras, o da merenda é do de Alimentação Escolar. A nutricionista acompanha
  a rede inteira porque o almoxarifado dela atende a rede inteira — não porque
  a trava foi desligada para ela.
- **Almoxarifado sem setor** é alcançado por qualquer lotação de setor. É o
  estado de hoje, e a coluna nasce nullable de propósito: transformá-la em
  obrigatória de uma vez tiraria o estoque das mãos de quem já o opera. O setor
  se preenche na tela, almoxarifado por almoxarifado.
- **Sem lotação nenhuma** — administrador, e quem o produto ainda não lotou —
  continua alcançando tudo. Trocar isso por "não alcança nada" trancaria o
  sistema em produção no dia da migration.

**Só o almoxarifado.** Nos outros módulos o papel `UNIDADE` não tem permissão
para entrar, então a trava seria uma segunda fechadura na mesma porta.

### A trava mora no SQL

O alcance entra como parâmetro em cada consulta, não como filtro no caso de uso.
Caso de uso que filtra depois já leu o dado alheio, e basta uma rota nova
esquecer a chamada para o vazamento voltar. Como array de `uuid` — `NULL`
significando "alcança tudo" —, a mesma cláusula serve a todas as consultas e o
teste consegue conferir uma por uma.

### Locais atendidos, sem depender do patrimônio

Criar e editar local vivia em `/patrimonio/locais`. Como patrimônio e
almoxarifado são vendidos separados, a prefeitura que comprasse só o segundo não
teria como cadastrar uma escola. O CRUD passa a existir também em
`/almoxarifado/locais`, com `stock:manage`, gravando na **mesma** tabela
`local` — que é o que ela sempre foi, um local físico compartilhado entre
módulos. Tabela própria faria a mesma escola existir duas vezes, com dois CNPJs
livres para divergir bem no dado que o PNAE cobra.
