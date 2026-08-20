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

## Navegação: um sistema por módulo (implementado)

Cada módulo é um **sistema à parte**, com URL, navegação e cor próprias — nenhuma tela cita
tela de outro módulo. A raiz `/` é um hub que lista só os sistemas liberados para o papel e para
a prefeitura. Prefixos: `/processos`, `/patrimonio`, `/administracao` (unidades, setores e
usuários, que servem a todos os sistemas). O `WorkspaceShell` injeta a cor de destaque do módulo
e redireciona para `/modulo-indisponivel` se a prefeitura não tiver o módulo.

## Módulo Patrimônio (API + telas implementadas na 1ª fatia)

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

**1ª fatia entregue**: locais, categorias, entrada em lote com tombamento sequencial por local e
inventário periódico com folha de conferência. **Transferência entre locais e baixa formal ficaram
para a fatia seguinte** — a tela de bens é somente leitura por enquanto. O código do local não pode
ser editado depois de criado, porque já compõe o tombamento dos bens.

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
