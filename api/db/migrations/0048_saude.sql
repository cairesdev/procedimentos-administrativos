-- 0048 — Ficha hospitalar: o papel do pronto atendimento vira registro.
--
-- O Hospital Municipal atende em papel. A ficha tem duas folhas, passa por
-- quatro mãos na mesma visita e termina numa pasta. Consultar o que aconteceu
-- com um paciente há oito meses é procurar fisicamente; série histórica de
-- qualquer coisa é inviável. Foi isso que motivou o módulo.
--
-- A ficha **não é um cadastro, é uma esteira**: recepção identifica →
-- enfermeiro tria → médico avalia, pede exame, prescreve e executa
-- procedimento → técnico de enfermagem carimba o horário de cada medicação →
-- enfermeiro dá a saída. Cada trecho do papel traz impresso de quem é a
-- assinatura e o carimbo. As tabelas abaixo existem para preservar essa
-- divisão, não para achatá-la num formulário só.
--
-- Levantamento consolidado em `docs/decisoes.md`, seção "Ficha hospitalar".

-- ---------------------------------------------------------------------------
-- O MÓDULO
--
-- Prefeitura sem hospital não vê nada disto. Dado de saúde é o mais sensível
-- que o produto guarda, o que faz da chave do módulo uma trava de acesso e não
-- só um item de menu.

ALTER TABLE orgao_modulo DROP CONSTRAINT orgao_modulo_modulo_check;
ALTER TABLE orgao_modulo ADD CONSTRAINT orgao_modulo_modulo_check
  CHECK (modulo IN ('PROCESSOS', 'FROTAS', 'PATRIMONIO', 'ALMOXARIFADO',
                    'PROTOCOLO', 'CHECKLIST', 'SAUDE'));

-- ---------------------------------------------------------------------------
-- OS QUATRO PAPÉIS
--
-- É o que o papel encoda. Nenhum deles enxerga licitação, contrato, frota ou
-- patrimônio — a matriz de permissões (`domain/shared/Permissoes.ts`) continua
-- sem herança comum, e é lá que o alcance de cada um está escrito.

ALTER TABLE usuario DROP CONSTRAINT usuario_papel_base_check;

ALTER TABLE usuario ADD CONSTRAINT usuario_papel_base_check
  CHECK (papel_base IN (
    'ADMIN', 'GESTOR', 'SERVIDOR', 'PROTOCOLO',
    'COMPRAS', 'CONTROLADORIA', 'NUTRICIONISTA', 'UNIDADE',
    'PATRIMONIO', 'FROTAS',
    'SAUDE_RECEPCAO', 'SAUDE_TECNICO', 'SAUDE_ENFERMEIRO', 'SAUDE_MEDICO'
  ));

-- O conselho profissional é o carimbo.
--
-- Sem CRM/COREN o profissional não fecha bloco nenhum: é o que vai impresso na
-- ficha e é o que identifica o responsável perante o conselho. Não há API
-- pública de CFM nem de COFEN (ver `docs/integracao-cnes.md`), então isto é
-- digitado — o que o CNES prova é outra coisa, o vínculo com o hospital.
--
-- Fica em `usuario` e não numa tabela à parte porque é atributo de uma pessoa,
-- não um relacionamento: ninguém tem dois CRMs.
ALTER TABLE usuario
  ADD COLUMN conselho_tipo   VARCHAR(10)
    CHECK (conselho_tipo IN ('CRM', 'COREN')),
  ADD COLUMN conselho_numero VARCHAR(20),
  ADD COLUMN conselho_uf     CHAR(2),
  -- Ocupação no CNES. Preenchida pela consulta ao barramento quando ela
  -- responder; digitada quando não.
  ADD COLUMN cbo             VARCHAR(6);

-- Os três andam juntos ou nenhum anda. Conselho sem UF não identifica ninguém:
-- CRM 1234 existe em 27 estados.
ALTER TABLE usuario ADD CONSTRAINT usuario_conselho_completo
  CHECK (num_nonnulls(conselho_tipo, conselho_numero, conselho_uf) IN (0, 3));

-- ---------------------------------------------------------------------------
-- O ESTABELECIMENTO
--
-- Tabela própria, e não a `unidade` administrativa, porque as duas respondem a
-- perguntas diferentes: `unidade` é secretaria que consome contrato e faz
-- solicitação; isto aqui é o que o CNES conhece, com código, tipo e endereço
-- vindos do cadastro nacional. Misturar as duas colocaria código CNES em
-- secretaria de obras.
--
-- O vínculo com `unidade` é opcional e existe só para o organograma amarrar as
-- pontas quando a prefeitura quiser.

CREATE TABLE unidade_saude (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id      UUID NOT NULL REFERENCES orgao(id),
  unidade_id    UUID REFERENCES unidade(id),

  nome          VARCHAR(150) NOT NULL,

  -- Código CNES, sete dígitos. Único na prefeitura: dois cadastros do mesmo
  -- estabelecimento partiriam a série histórica em duas.
  codigo_cnes   VARCHAR(7),

  -- 5 = HOSPITAL GERAL, 2 = UBS, 1 = POSTO. Vem do CNES junto com o código;
  -- guardado para a tela dizer o que a unidade é sem consultar de novo.
  tipo_unidade  INTEGER,

  endereco      VARCHAR(200),
  telefone      VARCHAR(20),

  -- Quando a consulta ao CNES foi feita. Toda leitura externa fica datada:
  -- sem isto ninguém sabe se o dado é de ontem ou de 2019, e um cadastro
  -- velho apresentado como atual é pior que cadastro vazio.
  cnes_consultado_em TIMESTAMPTZ,

  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (btrim(nome) <> ''),
  CHECK (codigo_cnes IS NULL OR codigo_cnes ~ '^[0-9]{7}$')
);
CREATE INDEX idx_unidade_saude_orgao ON unidade_saude(orgao_id);
CREATE UNIQUE INDEX idx_unidade_saude_cnes
  ON unidade_saude(orgao_id, codigo_cnes) WHERE codigo_cnes IS NOT NULL;

-- ---------------------------------------------------------------------------
-- O PACIENTE
--
-- Cadastro da prefeitura, com `orgao_id` — nunca global, ao contrário de
-- `fornecedor`. A exceção global existe porque um fornecedor quer ser
-- encontrado por todas as prefeituras; um paciente quer exatamente o
-- contrário.
--
-- `requerente` não serve e não foi reaproveitado: tem um documento só, sem
-- CNS, sem nome da mãe, e é alcançável por todo papel que atende balcão.

CREATE TABLE paciente (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id       UUID NOT NULL REFERENCES orgao(id),

  -- O número do prontuário, atribuído uma vez e carregado para sempre. É o que
  -- a equipe já usa no papel e o que costura a série histórica. Não reinicia
  -- por ano — por isso entra em `numeracao_sequencia` com `ano = 0`, que é a
  -- convenção deste projeto para sequência que não vira o ano.
  prontuario     INTEGER NOT NULL,

  nome           VARCHAR(200) NOT NULL,

  -- Campo de primeira classe, não observação: é o desempatador real entre
  -- homônimos na saúde pública, e é por isso que está no papel logo abaixo do
  -- nome.
  nome_mae       VARCHAR(200),

  data_nascimento DATE,
  sexo           CHAR(1) CHECK (sexo IN ('M', 'F', 'I')),

  -- Cinco documentos, todos opcionais.
  --
  -- O SUS registra por Cartão, o Bolsa Família por NIS, e quem chega de carro
  -- tem a CNH no bolso e mais nada. Um campo só obrigaria a recepção a
  -- cadastrar a mesma pessoa de novo na segunda visita — que é como nascem
  -- prontuários duplicados.
  cns            VARCHAR(15),
  cpf            VARCHAR(11),
  nis            VARCHAR(11),
  cnh            VARCHAR(11),
  rg             VARCHAR(20),

  endereco       VARCHAR(200),
  cidade         VARCHAR(100),
  uf             CHAR(2),
  telefone       VARCHAR(20),

  -- O papel coleta. Serve para contato administrativo; **nenhum dado clínico
  -- sai por e-mail**, e a fila da 0047 não é usada por este módulo.
  email          VARCHAR(150),

  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por     UUID REFERENCES usuario(id),

  UNIQUE (orgao_id, prontuario),
  CHECK (btrim(nome) <> ''),
  CHECK (cns IS NULL OR cns ~ '^[0-9]{15}$'),
  CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$'),
  CHECK (nis IS NULL OR nis ~ '^[0-9]{11}$'),
  CHECK (cnh IS NULL OR cnh ~ '^[0-9]{11}$')
);
CREATE INDEX idx_paciente_orgao ON paciente(orgao_id);
CREATE INDEX idx_paciente_nome ON paciente(orgao_id, nome);

-- Cada documento é único na prefeitura quando preenchido. Índices parciais
-- porque nulo repete à vontade: a maioria dos pacientes terá dois ou três dos
-- cinco, e um UNIQUE comum trataria os nulos como colisão em Postgres antigo.
CREATE UNIQUE INDEX idx_paciente_cns ON paciente(orgao_id, cns) WHERE cns IS NOT NULL;
CREATE UNIQUE INDEX idx_paciente_cpf ON paciente(orgao_id, cpf) WHERE cpf IS NOT NULL;
CREATE UNIQUE INDEX idx_paciente_nis ON paciente(orgao_id, nis) WHERE nis IS NOT NULL;
CREATE UNIQUE INDEX idx_paciente_cnh ON paciente(orgao_id, cnh) WHERE cnh IS NOT NULL;
CREATE UNIQUE INDEX idx_paciente_rg  ON paciente(orgao_id, rg)  WHERE rg  IS NOT NULL;

-- Alergia e crônicas pertencem ao paciente, não à visita.
--
-- No papel, "Portador: HAS / DM / Alergia / Outros" é reescrito a cada
-- atendimento e some quando alguém esquece. Aqui persiste, e é o que permite
-- avisar antes da prescrição.
CREATE TABLE paciente_condicao (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id   UUID NOT NULL REFERENCES paciente(id),
  tipo          VARCHAR(20) NOT NULL
                  CHECK (tipo IN ('HAS', 'DM', 'ALERGIA', 'OUTRO')),
  descricao     VARCHAR(300),
  registrado_por UUID REFERENCES usuario(id),
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Alergia sem dizer a quê não serve para nada na hora de prescrever.
  CHECK (tipo <> 'ALERGIA' OR btrim(COALESCE(descricao, '')) <> '')
);
CREATE INDEX idx_paciente_condicao_paciente ON paciente_condicao(paciente_id);

-- ---------------------------------------------------------------------------
-- O ATENDIMENTO
--
-- A visita. Tudo o mais pendura aqui e alcança a prefeitura por join nesta
-- tabela — a regra do `orgao_id` continua valendo palavra por palavra.

CREATE TABLE atendimento (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id       UUID NOT NULL REFERENCES orgao(id),
  unidade_saude_id UUID NOT NULL REFERENCES unidade_saude(id),

  -- 000123/2026, a mesma numeração do resto do sistema.
  numero         VARCHAR(20) NOT NULL,

  -- Nulo enquanto ninguém sabe quem é.
  --
  -- Inconsciente, sem acompanhante e sem documento: registra-se a hora e o
  -- socorro começa. Exigir CNS antes de atender não produz dado limpo, produz
  -- número inventado.
  paciente_id    UUID REFERENCES paciente(id),

  aberto_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  aberto_por     UUID NOT NULL REFERENCES usuario(id),

  status         VARCHAR(20) NOT NULL DEFAULT 'EM_ANDAMENTO'
                   CHECK (status IN ('EM_ANDAMENTO', 'ENCERRADO')),

  UNIQUE (orgao_id, numero),

  -- Atendimento encerrado sem paciente identificado é ficha que ninguém
  -- consegue achar depois. O desfecho só fecha com identificação — a regra
  -- vive aqui porque a tela pode ser contornada e o banco não.
  CHECK (status = 'EM_ANDAMENTO' OR paciente_id IS NOT NULL)
);
CREATE INDEX idx_atendimento_orgao ON atendimento(orgao_id, aberto_em DESC);
CREATE INDEX idx_atendimento_paciente ON atendimento(paciente_id, aberto_em DESC);

-- NÃO EXISTE COLUNA `arquivado_em`, E É DE PROPÓSITO.
--
-- A decisão 8 do levantamento diz: guarda de vinte anos (Parecer CFM 19/2026),
-- tela mostra um. Isso é **filtro**, não estado: a consulta padrão corta em
-- `aberto_em > now() - interval '12 months'` e o histórico completo do
-- paciente ignora o corte.
--
-- Uma coluna exigiria alguém para preenchê-la — uma rotina noturna que, no dia
-- em que falhasse, deixaria a ficha de ontem "arquivada" ou a de 2019 "ativa",
-- sem ninguém perceber. Este projeto já ficou 22 horas com um worker morto e
-- uma tela dizendo que estava tudo bem. Data não precisa de vigia.

-- ---------------------------------------------------------------------------
-- OS BLOCOS ASSINADOS
--
-- Cada um repete `fechado_por` / `fechado_em`. A repetição é deliberada: é o
-- carimbo do papel, e é o que permite a ficha impressa dizer quem escreveu
-- cada trecho.
--
-- **Fechado não se edita.** A imutabilidade é imposta pelo gatilho no fim
-- desta migration, não pela tela: apagar o que um profissional escreveu é
-- adulteração de prontuário, e a tela pode ser contornada.

-- Triagem: ato privativo do enfermeiro.
--
-- Um por atendimento. No plantão de madrugada sem enfermeiro, fica em branco e
-- os sinais vitais entram na avaliação médica — que é o que acontece no papel
-- hoje e não é ato de enfermagem assinado por quem não é enfermeiro.
CREATE TABLE triagem (
  atendimento_id  UUID PRIMARY KEY REFERENCES atendimento(id),

  -- Sinais vitais. Todos opcionais: o paciente que chega em parada não espera
  -- alguém medir glicemia para ser registrado.
  --
  -- As faixas abaixo não são diagnóstico — são erro de digitação. Temperatura
  -- 368 °C e pulso 800 não existem; 41,5 °C existe e não pode ser bloqueado.
  glicemia        INTEGER CHECK (glicemia BETWEEN 10 AND 1000),
  pa_sistolica    INTEGER CHECK (pa_sistolica BETWEEN 40 AND 300),
  pa_diastolica   INTEGER CHECK (pa_diastolica BETWEEN 20 AND 200),
  pulso           INTEGER CHECK (pulso BETWEEN 20 AND 300),
  saturacao       INTEGER CHECK (saturacao BETWEEN 30 AND 100),
  temperatura     NUMERIC(4,1) CHECK (temperatura BETWEEN 25.0 AND 45.0),

  queixa          TEXT,

  conduta         VARCHAR(30)
                    CHECK (conduta IN ('URGENCIA', 'ENCAMINHADO_UBS',
                                       'ENCAMINHADO_INTERNACAO')),
  prioridade      BOOLEAN NOT NULL DEFAULT FALSE,

  fechado_por     UUID REFERENCES usuario(id),
  fechado_em      TIMESTAMPTZ,

  -- Diastólica maior que sistólica é sempre erro de digitação, e passaria
  -- calada para o prontuário.
  CHECK (pa_sistolica IS NULL OR pa_diastolica IS NULL OR pa_sistolica > pa_diastolica),
  CHECK ((fechado_por IS NULL) = (fechado_em IS NULL))
);

-- Avaliação médica: a queixa clínica da segunda metade da primeira folha.
CREATE TABLE avaliacao_medica (
  atendimento_id  UUID PRIMARY KEY REFERENCES atendimento(id),
  queixa_clinica  TEXT NOT NULL,
  fechado_por     UUID REFERENCES usuario(id),
  fechado_em      TIMESTAMPTZ,
  CHECK (btrim(queixa_clinica) <> ''),
  CHECK ((fechado_por IS NULL) = (fechado_em IS NULL))
);

-- Exames solicitados e resultados. O resultado chega depois — às vezes dias
-- depois —, por isso é a mesma linha e não dois registros.
CREATE TABLE exame (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id  UUID NOT NULL REFERENCES atendimento(id),
  descricao       VARCHAR(300) NOT NULL,
  resultado       TEXT,
  solicitado_por  UUID NOT NULL REFERENCES usuario(id),
  solicitado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resultado_por   UUID REFERENCES usuario(id),
  resultado_em    TIMESTAMPTZ,
  CHECK (btrim(descricao) <> ''),
  CHECK ((resultado_por IS NULL) = (resultado_em IS NULL)),
  CHECK (resultado IS NULL OR resultado_em IS NOT NULL)
);
CREATE INDEX idx_exame_atendimento ON exame(atendimento_id);

-- ---------------------------------------------------------------------------
-- PRESCRIÇÃO E ADMINISTRAÇÃO
--
-- No papel são duas colunas pareadas: o médico escreve à esquerda, o técnico
-- carimba o horário à direita. São dois atos de duas pessoas diferentes, e por
-- isso são duas tabelas.
--
-- Itens estruturados, e não texto corrido, porque a coluna de horários só faz
-- sentido item a item — e porque texto corrido fecharia a porta da conferência
-- de medicação e da farmácia ligada ao estoque.

CREATE TABLE prescricao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id  UUID NOT NULL REFERENCES atendimento(id),

  -- Dieta, repouso, cuidados: o que não cabe em dose e via.
  orientacoes     TEXT,

  fechado_por     UUID REFERENCES usuario(id),
  fechado_em      TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((fechado_por IS NULL) = (fechado_em IS NULL))
);
CREATE INDEX idx_prescricao_atendimento ON prescricao(atendimento_id);

CREATE TABLE prescricao_item (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescricao_id   UUID NOT NULL REFERENCES prescricao(id),
  medicamento     VARCHAR(200) NOT NULL,
  dose            VARCHAR(60) NOT NULL,
  via             VARCHAR(20) NOT NULL
                    CHECK (via IN ('ORAL', 'IV', 'IM', 'SC', 'TOPICA',
                                   'INALATORIA', 'RETAL', 'OUTRA')),
  frequencia      VARCHAR(60) NOT NULL,
  observacao      VARCHAR(300),
  CHECK (btrim(medicamento) <> ''),
  CHECK (btrim(dose) <> ''),
  CHECK (btrim(frequencia) <> '')
);
CREATE INDEX idx_prescricao_item_prescricao ON prescricao_item(prescricao_id);

-- A coluna da direita do papel.
--
-- Uma linha por horário efetivamente administrado, com quem administrou. O
-- horário é do relógio de quem deu o remédio, não do servidor: a enfermagem
-- registra depois, e forçar `now()` transformaria "dei às 22h" em "registrei
-- às 23h40".
CREATE TABLE administracao (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescricao_item_id UUID NOT NULL REFERENCES prescricao_item(id),
  horario            TIMESTAMPTZ NOT NULL,
  executado_por      UUID NOT NULL REFERENCES usuario(id),
  registrado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacao         VARCHAR(300)
);
CREATE INDEX idx_administracao_item ON administracao(prescricao_item_id);

-- ---------------------------------------------------------------------------
-- EVOLUÇÃO, PROCEDIMENTO E SAÍDA

-- Duas caixas no papel: uma da enfermagem, outra do médico. Uma tabela com
-- tipo, porque o registro é o mesmo — texto datado e assinado — e o que muda é
-- quem pode escrever, que é regra de permissão e não de schema.
CREATE TABLE evolucao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id  UUID NOT NULL REFERENCES atendimento(id),
  tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('ENFERMAGEM', 'MEDICA')),
  texto           TEXT NOT NULL,
  fechado_por     UUID NOT NULL REFERENCES usuario(id),
  fechado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (btrim(texto) <> '')
);
CREATE INDEX idx_evolucao_atendimento ON evolucao(atendimento_id, fechado_em);

CREATE TABLE procedimento (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id  UUID NOT NULL REFERENCES atendimento(id),
  tipo            VARCHAR(30) NOT NULL
                    CHECK (tipo IN ('URGENCIA_SEM_OBSERVACAO',
                                    'URGENCIA_COM_OBSERVACAO', 'SUTURA',
                                    'CURATIVO', 'NEBULIZACAO',
                                    'CIRURGIA_AMBULATORIAL', 'OUTRO')),
  descricao       VARCHAR(300),
  executado_por   UUID NOT NULL REFERENCES usuario(id),
  executado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- "Outros" no papel tem uma linha extensa ao lado. Sem ela o registro diz
  -- que houve um procedimento e não diz qual.
  CHECK (tipo <> 'OUTRO' OR btrim(COALESCE(descricao, '')) <> '')
);
CREATE INDEX idx_procedimento_atendimento ON procedimento(atendimento_id);

-- O desfecho é único e terminal. Depois dele o atendimento não recebe registro
-- novo — o que vier é atendimento novo.
CREATE TABLE desfecho (
  atendimento_id  UUID PRIMARY KEY REFERENCES atendimento(id),
  tipo            VARCHAR(20) NOT NULL
                    CHECK (tipo IN ('ALTA', 'ENCAMINHAMENTO', 'OBITO')),

  -- Para onde. "Encaminhamento para ____" é uma linha longa no papel, e um
  -- encaminhamento sem destino não encaminha ninguém.
  destino         VARCHAR(200),

  -- O horário da saída é o do relógio da parede, pelo mesmo motivo da
  -- administração: quem assina registra depois.
  horario         TIMESTAMPTZ NOT NULL,

  fechado_por     UUID NOT NULL REFERENCES usuario(id),
  fechado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (tipo <> 'ENCAMINHAMENTO' OR btrim(COALESCE(destino, '')) <> '')
);

-- ---------------------------------------------------------------------------
-- A RETIFICAÇÃO
--
-- Corrigir prontuário existe e é bem-vindo; apagar, não. É a rasura datada e
-- rubricada do papel: o registro original permanece, a correção entra ao lado
-- com autor e hora próprios, e a ficha impressa mostra as duas.
--
-- `tabela_origem` é texto e não uma FK porque a retificação alcança sete
-- tabelas diferentes; o CHECK abaixo é a lista fechada.

CREATE TABLE retificacao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id  UUID NOT NULL REFERENCES atendimento(id),
  tabela_origem   VARCHAR(30) NOT NULL
                    CHECK (tabela_origem IN ('triagem', 'avaliacao_medica',
                                             'exame', 'prescricao', 'evolucao',
                                             'procedimento', 'desfecho')),
  registro_id     UUID NOT NULL,
  texto           TEXT NOT NULL,
  autor_id        UUID NOT NULL REFERENCES usuario(id),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (btrim(texto) <> '')
);
CREATE INDEX idx_retificacao_atendimento ON retificacao(atendimento_id);
CREATE INDEX idx_retificacao_registro ON retificacao(registro_id);

-- ---------------------------------------------------------------------------
-- A TRAVA DA IMUTABILIDADE
--
-- O que já foi fechado não muda mais. A tela impede, o caso de uso impede — e
-- o banco impede, porque é o único dos três que não se contorna com um cliente
-- HTTP e uma rota esquecida.
--
-- Vale só para as tabelas de fecho opcional (triagem, avaliação, prescrição).
-- Evolução, procedimento e desfecho já nascem fechados: não têm estado
-- intermediário, e por isso qualquer UPDATE neles é proibido de saída.

CREATE OR REPLACE FUNCTION saude_bloqueia_edicao_apos_fecho()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.fechado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Registro clínico fechado não pode ser alterado; use retificação'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_triagem_imutavel
  BEFORE UPDATE ON triagem
  FOR EACH ROW EXECUTE FUNCTION saude_bloqueia_edicao_apos_fecho();

CREATE TRIGGER trg_avaliacao_imutavel
  BEFORE UPDATE ON avaliacao_medica
  FOR EACH ROW EXECUTE FUNCTION saude_bloqueia_edicao_apos_fecho();

CREATE TRIGGER trg_prescricao_imutavel
  BEFORE UPDATE ON prescricao
  FOR EACH ROW EXECUTE FUNCTION saude_bloqueia_edicao_apos_fecho();

CREATE OR REPLACE FUNCTION saude_registro_nasce_fechado()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Registro clínico não pode ser alterado; use retificação'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_evolucao_imutavel
  BEFORE UPDATE ON evolucao
  FOR EACH ROW EXECUTE FUNCTION saude_registro_nasce_fechado();

CREATE TRIGGER trg_procedimento_imutavel
  BEFORE UPDATE ON procedimento
  FOR EACH ROW EXECUTE FUNCTION saude_registro_nasce_fechado();

CREATE TRIGGER trg_desfecho_imutavel
  BEFORE UPDATE ON desfecho
  FOR EACH ROW EXECUTE FUNCTION saude_registro_nasce_fechado();

-- `administracao` não entra: o horário é lançado uma vez e pronto, e a linha
-- é o próprio carimbo. `exame` também não, porque o resultado chega depois —
-- é a única tabela do módulo em que uma segunda escrita é o comportamento
-- esperado, e o CHECK acima já impede resultado sem autor e sem hora.

-- ---------------------------------------------------------------------------
-- A FICHA IMPRESSA
--
-- O hospital precisa continuar imprimindo: para a pasta física durante a
-- transição, para o paciente que pede, e para quando faltar energia — que num
-- hospital de plantão 24 horas não é hipótese, é terça-feira.
--
-- A peça reproduz as duas folhas do papel, na mesma ordem, com o carimbo de
-- quem assinou cada bloco embaixo dele. Global (`orgao_id IS NULL`): a ficha
-- do pronto atendimento é a mesma em qualquer prefeitura, e o que muda — o
-- timbre — já vem de `orgao_documento_config`.

-- O escopo entra no CHECK junto com a peça. A lista fechada é o que impede o
-- administrador de criar modelo apontando para um escopo que o código não sabe
-- buscar — modelo que existe e não emite nada.
ALTER TABLE documento_modelo DROP CONSTRAINT IF EXISTS documento_modelo_escopo_check;
ALTER TABLE documento_modelo
  ADD CONSTRAINT documento_modelo_escopo_check
  CHECK (escopo IN (
    'PROCESSO', 'PROCESSO_CONTRATO', 'ORDEM_FORNECIMENTO', 'SOLICITACAO',
    'BEM', 'TRANSFERENCIA_BEM', 'BAIXA_BEM', 'INVENTARIO',
    'VIAGEM', 'MANUTENCAO',
    'SOLICITACAO_ESTOQUE', 'ENTRADA_ESTOQUE', 'DEVOLUCAO_ESTOQUE',
    'RELATORIO_CONSUMO', 'CHECKLIST',
    'RELATORIO_PANORAMA', 'RELATORIO_SETOR',
    'FICHA_ATENDIMENTO'
  ));

ALTER TABLE documento_modelo DROP CONSTRAINT documento_modelo_modulo_check;
ALTER TABLE documento_modelo ADD CONSTRAINT documento_modelo_modulo_check
  CHECK (modulo IN ('PROCESSOS', 'PATRIMONIO', 'FROTAS', 'ALMOXARIFADO',
                    'CHECKLIST', 'SAUDE'));

INSERT INTO documento_modelo (orgao_id, modulo, escopo, tipo, nome, titulo, corpo)
VALUES
(NULL, 'SAUDE', 'FICHA_ATENDIMENTO', 'FICHA_ATENDIMENTO',
 'Ficha de atendimento', 'FICHA DE ATENDIMENTO',
$corpo$<p style="text-align: center; margin: 0 0 14px"><small>Atendimento {{atendimento.numero}} &middot; {{atendimento.unidade}} &middot; aberto em {{atendimento.abertoEm}}</small></p>

<p style="margin: 0 0 4px"><small>IDENTIFICAÇÃO DO PACIENTE</small></p>

<p style="font-size: 15pt; font-weight: bold; margin: 0 0 2px">{{paciente.nome}}</p>

<p style="margin: 0 0 2px"><small>Prontuário {{paciente.prontuario}} &middot; nascimento {{paciente.dataNascimento}} &middot; Cartão do SUS {{paciente.cns}}</small></p>

<p style="margin: 0 0 2px"><small>Mãe: {{paciente.nomeMae}}</small></p>

<p style="margin: 0 0 16px"><small>{{paciente.endereco}} &middot; {{paciente.cidade}}/{{paciente.uf}} &middot; {{paciente.telefone}}</small></p>

<p style="margin: 0 0 16px"><small><b>Portador:</b> {{paciente.condicoes}}</small></p>

<hr />

<p style="text-align: center; margin: 14px 0 8px"><b>TRIAGEM DE ENFERMAGEM</b></p>

<table>
<tr><th>Glicemia</th><th>PA</th><th>Pulso</th><th>Saturação</th><th>Temperatura</th></tr>
<tr><td>{{triagem.glicemia}} mg/dL</td><td>{{triagem.pressao}} mmHg</td><td>{{triagem.pulso}} bpm</td><td>{{triagem.saturacao}} %</td><td>{{triagem.temperatura}} °C</td></tr>
</table>

<p style="margin: 10px 0 2px"><small>QUEIXA CLÍNICA</small></p>

<p style="margin: 0 0 10px">{{triagem.queixa}}</p>

<p style="margin: 0 0 10px"><small><b>Conduta:</b> {{triagem.conduta}} &middot; <b>Prioridade de atendimento:</b> {{triagem.prioridade}}</small></p>

<p style="text-align: right; margin: 0 0 16px"><small>{{triagem.assinatura}}</small></p>

<hr />

<p style="text-align: center; margin: 14px 0 8px"><b>SERVIÇO MÉDICO</b></p>

<p style="margin: 0 0 4px"><small>QUEIXA CLÍNICA</small></p>

<p style="margin: 0 0 8px">{{avaliacao.queixaClinica}}</p>

<p style="text-align: right; margin: 0 0 16px"><small>{{avaliacao.assinatura}}</small></p>

<p style="margin: 0 0 4px"><small>EXAMES SOLICITADOS / RESULTADOS</small></p>

<table>
<tr><th>Exame</th><th>Resultado</th><th>Solicitado por</th></tr>
{{#exames}}<tr><td>{{descricao}}</td><td>{{resultado}}</td><td>{{solicitadoPor}}</td></tr>{{/exames}}
</table>

<p style="margin: 16px 0 4px"><small>PRESCRIÇÃO MÉDICA E HORÁRIOS DA ENFERMAGEM</small></p>

<table>
<tr><th>Medicamento</th><th>Dose</th><th>Via</th><th>Frequência</th><th>Horários administrados (aux./téc. de Enfermagem)</th></tr>
{{#medicamentos}}<tr><td>{{medicamento}}</td><td>{{dose}}</td><td>{{via}}</td><td>{{frequencia}}</td><td>{{horarios}}</td></tr>{{/medicamentos}}
</table>

<p style="margin: 8px 0 10px"><small><b>Orientações:</b> {{prescricao.orientacoes}}</small></p>

<p style="margin: 0 0 4px"><small>EVOLUÇÃO</small></p>

<table>
<tr><th>Quando</th><th>Por</th><th>Registro</th></tr>
{{#evolucoes}}<tr><td>{{quando}}</td><td>{{autor}}</td><td>{{texto}}</td></tr>{{/evolucoes}}
</table>

<p style="margin: 16px 0 4px"><small>PROCEDIMENTO REALIZADO</small></p>

<table>
<tr><th>Procedimento</th><th>Descrição</th><th>Executado por</th></tr>
{{#procedimentos}}<tr><td>{{tipo}}</td><td>{{descricao}}</td><td>{{autor}}</td></tr>{{/procedimentos}}
</table>

<hr />

<p style="text-align: center; margin: 14px 0 8px"><b>RESUMO DE SAÍDA DO PACIENTE</b></p>

<p style="text-align: center; font-size: 15pt; margin: 0 0 2px">{{desfecho.tipo}}</p>

<p style="text-align: center; margin: 0 0 4px"><small>{{desfecho.destino}}</small></p>

<p style="text-align: center; margin: 0 0 14px"><small>Horário: {{desfecho.horario}}</small></p>

<p style="text-align: right; margin: 0 0 16px"><small>{{desfecho.assinatura}}</small></p>

<p style="margin: 0 0 4px"><small>RETIFICAÇÕES</small></p>

<table>
<tr><th>Quando</th><th>Sobre</th><th>Correção</th><th>Autor</th></tr>
{{#retificacoes}}<tr><td>{{quando}}</td><td>{{sobre}}</td><td>{{texto}}</td><td>{{autor}}</td></tr>{{/retificacoes}}
</table>
$corpo$);

-- ---------------------------------------------------------------------------
-- NOTA SOBRE PRAZO DE GUARDA
--
-- Nenhuma tabela deste módulo tem expurgo, e nenhuma vai ter tão cedo.
-- Prontuário tem guarda mínima de 20 anos a contar do último registro
-- (Parecer CFM nº 19/2026). Quando o prazo chegar, o descarte precisa ser
-- formalizado, sigiloso e rastreável — um procedimento com ata, não um DELETE
-- agendado.
--
-- Consequência operacional que precisa ser resolvida antes de produção: o
-- backup diário do compose passa a carregar prontuário, e hoje ele é um bind
-- mount em disco da VPS, sem cifra. Está registrado em `docs/roadmap.md`.
