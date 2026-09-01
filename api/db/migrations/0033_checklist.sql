-- 0033 — Checklist: a lista de exigências a cumprir.
--
-- Serve por dentro (acompanhar o processo) e, na fatia seguinte, por fora (o
-- fornecedor cumprindo pelo link). Convive com a `exigencia` da 0018, que
-- continua sendo a pergunta avulsa do balcão ao cidadão — o checklist é a
-- lista **planejada**, com modelo reutilizável e vários itens.

ALTER TABLE orgao_modulo DROP CONSTRAINT orgao_modulo_modulo_check;
ALTER TABLE orgao_modulo ADD CONSTRAINT orgao_modulo_modulo_check
  CHECK (modulo IN ('PROCESSOS', 'FROTAS', 'PATRIMONIO', 'ALMOXARIFADO',
                    'PROTOCOLO', 'CHECKLIST'));

-- ---------------------------------------------------------------------------
-- MODELO: a lista escrita uma vez, aplicada muitas
--
-- Aplicar **copia** os itens para o checklist. Mudar o modelo depois não mexe
-- no que já foi aplicado, pela mesma razão que o documento emitido congela
-- seus dados: a lista de ontem precisa continuar dizendo o que se exigiu
-- ontem, e não o que se exige hoje.

CREATE TABLE checklist_modelo (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id   UUID NOT NULL REFERENCES orgao(id),
  nome       VARCHAR(150) NOT NULL,
  descricao  TEXT,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (orgao_id, nome)
);

CREATE TABLE checklist_modelo_item (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id          UUID NOT NULL REFERENCES checklist_modelo(id) ON DELETE CASCADE,
  ordem              INTEGER NOT NULL,
  titulo             VARCHAR(200) NOT NULL,
  descricao          TEXT,

  -- Anexo obrigatório ou não: "entregar a certidão" exige arquivo, "confirmar
  -- a visita técnica" não exige nada além da marcação.
  exige_anexo        BOOLEAN NOT NULL DEFAULT FALSE,

  -- Dias a partir da aplicação. A data limite só existe no checklist aplicado:
  -- no modelo, uma data fixa envelheceria junto com ele.
  prazo_dias         INTEGER CHECK (prazo_dias IS NULL OR prazo_dias > 0),

  -- Item que vence e volta a ser devido.
  --
  -- A certidão negativa entregue hoje vale por um tempo e depois precisa ser
  -- entregue de novo; "entregar o projeto assinado" se cumpre uma vez. Sem
  -- esta distinção, todo item carregaria uma validade que na maioria não
  -- existe — e "sem data" se confundiria com "esqueceram de preencher".
  recorrente         BOOLEAN NOT NULL DEFAULT FALSE,
  periodicidade_dias INTEGER,

  -- Para quem é o item: setor, departamento, ou o fornecedor externo. Nenhum
  -- dos três é válido — é o item que ainda não foi direcionado.
  setor_id           UUID REFERENCES setor(id),
  departamento_id    UUID REFERENCES departamento(id),
  para_fornecedor    BOOLEAN NOT NULL DEFAULT FALSE,

  UNIQUE (modelo_id, ordem),

  -- Recorrente sem periodicidade não sabe quando vence; periodicidade sem
  -- recorrência é número que ninguém lê. Andam juntos.
  -- Recorrência e periodicidade andam juntas.
  --
  -- Escrito com `IS NOT NULL`, e não com `AND periodicidade > 0` do lado
  -- verdadeiro: `TRUE AND NULL > 0` resulta em NULL, e **CHECK com NULL
  -- passa**. A primeira versão desta constraint aceitava item recorrente sem
  -- periodicidade — que vence sem nunca saber quando.
  CONSTRAINT checklist_modelo_item_recorrencia
    CHECK (recorrente = (periodicidade_dias IS NOT NULL)
           AND (periodicidade_dias IS NULL OR periodicidade_dias > 0)),

  -- Um destino, no máximo: dois responsáveis é ninguém responsável.
  CONSTRAINT checklist_modelo_item_destino
    CHECK (num_nonnulls(setor_id, departamento_id) + para_fornecedor::int <= 1)
);

-- ---------------------------------------------------------------------------
-- CHECKLIST: a lista aplicada
--
-- O alvo é polimórfico de propósito: processo, contrato, licitação,
-- fornecedor, bem, veículo — ou nenhum, e aí é uma lista que existe por si. É
-- o que atende "listas que não são só de sistemas internos".
--
-- Sem chave estrangeira, que é o preço do polimorfismo. O CHECK do vocabulário
-- impede o terceiro tipo inventado; o id apontar para um registro que sumiu é
-- risco assumido, e a tela trata alvo não encontrado.

CREATE TABLE checklist (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id         UUID NOT NULL REFERENCES orgao(id),

  -- De onde veio, quando veio de um modelo. Fica como rastro: o modelo pode
  -- ser editado ou inativado sem afetar esta lista.
  modelo_id        UUID REFERENCES checklist_modelo(id),

  titulo           VARCHAR(200) NOT NULL,
  descricao        TEXT,

  alvo_tipo        VARCHAR(20)
                     CHECK (alvo_tipo IS NULL OR alvo_tipo IN (
                       'PROCESSO', 'CONTRATO', 'LICITACAO', 'ATA',
                       'FORNECEDOR', 'BEM', 'VEICULO')),
  alvo_id          UUID,

  -- Responsável geral: acompanha a lista inteira, enquanto cada item tem o
  -- seu. Nenhum dos dois é obrigatório — lista avulsa pode não ter dono.
  setor_id         UUID REFERENCES setor(id),
  departamento_id  UUID REFERENCES departamento(id),

  criado_por       UUID REFERENCES usuario(id),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  encerrado_em     TIMESTAMPTZ,

  -- Tipo e id andam juntos: um sem o outro é alvo pela metade.
  CONSTRAINT checklist_alvo CHECK ((alvo_tipo IS NULL) = (alvo_id IS NULL)),
  CONSTRAINT checklist_responsavel
    CHECK (num_nonnulls(setor_id, departamento_id) <= 1)
);

CREATE INDEX idx_checklist_orgao ON checklist(orgao_id, criado_em DESC);
-- A pergunta mais frequente é "o que este processo tem pendente?".
CREATE INDEX idx_checklist_alvo ON checklist(alvo_tipo, alvo_id)
  WHERE alvo_id IS NOT NULL;

CREATE TABLE checklist_item (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id       UUID NOT NULL REFERENCES checklist(id) ON DELETE CASCADE,
  ordem              INTEGER NOT NULL,
  titulo             VARCHAR(200) NOT NULL,
  descricao          TEXT,
  exige_anexo        BOOLEAN NOT NULL DEFAULT FALSE,

  -- Data, e não dias: aqui o prazo já foi calculado a partir da aplicação, e
  -- congelado. Mudar o modelo depois não encurta prazo de quem já foi cobrado
  -- — mesma escolha da `exigencia.prazo_limite`.
  prazo_limite       DATE,

  recorrente         BOOLEAN NOT NULL DEFAULT FALSE,
  periodicidade_dias INTEGER,

  setor_id           UUID REFERENCES setor(id),
  departamento_id    UUID REFERENCES departamento(id),
  para_fornecedor    BOOLEAN NOT NULL DEFAULT FALSE,

  -- Dispensado: o item deixou de ser exigível.
  --
  -- Diferente de cumprido — ninguém entregou nada — e diferente de pendente,
  -- porque não se espera mais por ele. Exige justificativa: item que some da
  -- cobrança sem explicação é item que ninguém saberá por que sumiu.
  dispensado_em      TIMESTAMPTZ,
  dispensado_por     UUID REFERENCES usuario(id),
  dispensa_motivo    TEXT,

  UNIQUE (checklist_id, ordem),
  -- Mesma armadilha do NULL da tabela de modelo: ver o comentário lá.
  CONSTRAINT checklist_item_recorrencia
    CHECK (recorrente = (periodicidade_dias IS NOT NULL)
           AND (periodicidade_dias IS NULL OR periodicidade_dias > 0)),
  CONSTRAINT checklist_item_destino
    CHECK (num_nonnulls(setor_id, departamento_id) + para_fornecedor::int <= 1),
  CONSTRAINT checklist_item_dispensa
    CHECK ((dispensado_em IS NULL) = (dispensa_motivo IS NULL))
);

CREATE INDEX idx_checklist_item_checklist ON checklist_item(checklist_id, ordem);

-- ---------------------------------------------------------------------------
-- CUMPRIMENTO: uma linha por ciclo, e não três colunas no item
--
-- Cumprir nem sempre encerra o assunto. A certidão entregue hoje vale por um
-- tempo e depois precisa ser entregue de novo — e é isso que "data inicial de
-- cumprimento e data final que precisa ser cumprida novamente" significa.
--
-- Guardar `cumprido_em` e o anexo dentro do item faria o segundo cumprimento
-- apagar o primeiro. A prestação de contas do ano passado precisa mostrar a
-- certidão que valia **naquele** momento, e não a atual.
--
-- **O item não tem coluna de status.** A situação é derivada do último ciclo:
-- sem ciclo aceito e vigente, está pendente; com ciclo aguardando, está em
-- conferência; com ciclo aceito e vencido, voltou a pendente. Status
-- armazenado precisaria de alguém para expirá-lo, e uma coluna que diz
-- "cumprido" sobre uma certidão vencida mente.

CREATE TABLE checklist_item_cumprimento (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id            UUID NOT NULL REFERENCES checklist_item(id) ON DELETE CASCADE,

  -- Sobe a cada volta. Serve para ordenar e para a tela dizer "3ª entrega".
  ciclo              INTEGER NOT NULL,

  -- Quem cumpriu: um usuário, ou o fornecedor pelo link externo (2ª fatia),
  -- que não tem conta. Os dois nulos é o cumprimento sem autor registrado.
  cumprido_por       UUID REFERENCES usuario(id),
  cumprido_por_externo BOOLEAN NOT NULL DEFAULT FALSE,
  cumprido_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacao         TEXT,

  -- Até quando este cumprimento vale.
  --
  -- Calculada: `cumprido_em + periodicidade_dias` do item recorrente. Nula
  -- para item que se cumpre uma vez — e nulo aqui quer dizer "não vence",
  -- nunca "esqueceram de preencher", porque quem preenche é o sistema.
  vigencia_ate       DATE,

  -- Conferência: quem cumpre marca, quem cobra confere. Ninguém fecha o
  -- próprio item — sem esta etapa o checklist viraria declaração de quem
  -- cumpre, em vez de conferência.
  situacao           VARCHAR(12) NOT NULL DEFAULT 'AGUARDANDO'
                       CHECK (situacao IN ('AGUARDANDO', 'ACEITO', 'RECUSADO')),
  conferido_por      UUID REFERENCES usuario(id),
  conferido_em       TIMESTAMPTZ,
  recusa_motivo      TEXT,

  UNIQUE (item_id, ciclo),

  -- Resposta e data andam juntas: uma sem a outra é estado impossível.
  CONSTRAINT checklist_cumprimento_conferencia
    CHECK ((situacao = 'AGUARDANDO') = (conferido_em IS NULL)),

  -- Recusa sem motivo deixa quem cumpriu sem saber o que corrigir.
  CONSTRAINT checklist_cumprimento_recusa
    CHECK (situacao <> 'RECUSADO' OR recusa_motivo IS NOT NULL)
);

-- O último ciclo de cada item é a consulta mais quente do módulo: é ela que
-- diz a situação de tudo que a tela mostra.
CREATE INDEX idx_checklist_cumprimento_item
  ON checklist_item_cumprimento(item_id, ciclo DESC);

-- ---------------------------------------------------------------------------
-- ANEXO do cumprimento
--
-- Tabela própria porque `anexo` exige `processo_id`, e checklist avulso não
-- tem processo. Afrouxar aquela coluna para nullable seria mais barato hoje e
-- tiraria do banco a garantia de que todo anexo de processo pertence a um.
--
-- Pende do **cumprimento**, e não do item: cada ciclo tem o seu documento, e é
-- o do ciclo certo que a prestação de contas precisa mostrar.

CREATE TABLE checklist_anexo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cumprimento_id  UUID NOT NULL REFERENCES checklist_item_cumprimento(id) ON DELETE CASCADE,
  arquivo         VARCHAR(255) NOT NULL,
  nome_original   VARCHAR(255) NOT NULL,
  tamanho_bytes   BIGINT NOT NULL CHECK (tamanho_bytes > 0),
  enviado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_anexo_cumprimento ON checklist_anexo(cumprimento_id);

COMMENT ON TABLE checklist_item_cumprimento IS
  'Um ciclo de cumprimento. O item não tem status: ele é derivado do último ciclo.';
