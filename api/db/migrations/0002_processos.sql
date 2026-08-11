-- 0002 — Módulo de processos: licitação, ata, contrato, itens,
-- tramitação (protocolo genérico) e solicitação de itens.
-- Depende de 0001_nucleo.sql.

-- ============ Licitação e ata ============

CREATE TABLE licitacao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id        UUID NOT NULL REFERENCES orgao(id),
  numero          VARCHAR(40) NOT NULL, -- numero/ano ex 025/2026
  resumo          VARCHAR(300),
  objeto          TEXT NOT NULL,
  modalidade      VARCHAR(30) NOT NULL
                    CHECK (modalidade IN ('PREGAO_ELETRONICO', 'PREGAO_PRESENCIAL',
                                          'CONCORRENCIA', 'DISPENSA', 'INEXIGIBILIDADE',
                                          'CHAMADA_PUBLICA', 'LEILAO', 'DIALOGO_COMPETITIVO')),
  data_assinatura DATE NOT NULL,
  valor_total     NUMERIC(14,2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (orgao_id, numero)
);
CREATE INDEX idx_licitacao_orgao ON licitacao(orgao_id);

CREATE TABLE licitacao_unidade (
  licitacao_id UUID NOT NULL REFERENCES licitacao(id),
  unidade_id   UUID NOT NULL REFERENCES unidade(id),
  PRIMARY KEY (licitacao_id, unidade_id)
);

CREATE TABLE ata_registro_precos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id        UUID NOT NULL REFERENCES orgao(id),
  licitacao_id    UUID REFERENCES licitacao(id),
  numero          VARCHAR(40) NOT NULL, -- numero/ano próprio
  objeto          TEXT NOT NULL,
  data_assinatura DATE NOT NULL,
  data_vigencia   DATE NOT NULL, -- vencida: alerta, não origina novos contratos
  valor_total     NUMERIC(14,2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (orgao_id, numero)
);
CREATE INDEX idx_ata_orgao ON ata_registro_precos(orgao_id);

CREATE TABLE ata_item (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ata_id          UUID NOT NULL REFERENCES ata_registro_precos(id),
  produto         VARCHAR(150) NOT NULL,
  descricao       TEXT,
  unidade_medida  VARCHAR(20) NOT NULL,
  marca           VARCHAR(100),
  quantidade      NUMERIC(14,3) NOT NULL,
  valor_unitario  NUMERIC(14,4) NOT NULL,
  valor_total     NUMERIC(14,2) NOT NULL
);
CREATE INDEX idx_ata_item_ata ON ata_item(ata_id);

-- ============ Tramitação (criada antes de contrato, que referencia processo) ============

CREATE TABLE processo (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id                 UUID NOT NULL REFERENCES orgao(id),
  numero_protocolo         VARCHAR(20) NOT NULL, -- sequencial/ano, sequência própria
  numero_processo_adm      VARCHAR(20) NOT NULL, -- sequencial/ano, sequência separada
  tipo_processo            VARCHAR(30) NOT NULL
                             CHECK (tipo_processo IN ('SOLICITACAO_ITENS', 'PEDIDO_INFORMACAO',
                                                      'ATENDIMENTO_EXTERNO', 'CONTRATO', 'OUTRO')),
  requerente_id            UUID REFERENCES requerente(id),
  setor_atual_id           UUID REFERENCES setor(id),
  departamento_atual_id    UUID REFERENCES departamento(id),
  status                   VARCHAR(20) NOT NULL DEFAULT 'ABERTO'
                             CHECK (status IN ('ABERTO', 'TRAMITANDO', 'ENCERRADO', 'CANCELADO')),
  data_abertura            TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_encerramento        TIMESTAMPTZ,
  UNIQUE (orgao_id, numero_protocolo),
  UNIQUE (orgao_id, numero_processo_adm)
);
CREATE INDEX idx_processo_orgao ON processo(orgao_id);
CREATE INDEX idx_processo_setor_atual ON processo(setor_atual_id);

CREATE TABLE despacho (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id      UUID NOT NULL REFERENCES processo(id),
  setor_id         UUID NOT NULL REFERENCES setor(id),
  departamento_id  UUID REFERENCES departamento(id),
  usuario_id       UUID NOT NULL REFERENCES usuario(id),
  lotacao_id       UUID NOT NULL REFERENCES lotacao(id), -- em nome de qual lotação agiu
  tipo             VARCHAR(30) NOT NULL
                     CHECK (tipo IN ('ANALISE', 'ENCAMINHAMENTO', 'PARECER',
                                     'ORDEM_FORNECIMENTO', 'CANCELAMENTO')),
  texto            TEXT,
  data             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_despacho_processo ON despacho(processo_id);

CREATE TABLE anexo (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id                UUID NOT NULL REFERENCES processo(id),
  despacho_id                UUID REFERENCES despacho(id),
  tipo_documento             VARCHAR(60) NOT NULL,
  arquivo                    VARCHAR(255) NOT NULL,
  enviado_por_usuario_id     UUID REFERENCES usuario(id),
  enviado_por_requerente_id  UUID REFERENCES requerente(id),
  data                       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(enviado_por_usuario_id, enviado_por_requerente_id) = 1)
);
CREATE INDEX idx_anexo_processo ON anexo(processo_id);

CREATE TABLE fluxo_configuracao (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id                  UUID NOT NULL REFERENCES orgao(id),
  tipo_processo             VARCHAR(30) NOT NULL,
  permite_override_usuario  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (orgao_id, tipo_processo)
);

CREATE TABLE fluxo_etapa (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id                UUID NOT NULL REFERENCES fluxo_configuracao(id),
  ordem                   INTEGER NOT NULL,
  setor_id                UUID NOT NULL REFERENCES setor(id),
  departamento_id         UUID REFERENCES departamento(id), -- destino granular opcional
  prazo_dias              INTEGER,
  prazo_ativo             BOOLEAN NOT NULL DEFAULT FALSE,
  visibilidade_estendida  BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (fluxo_id, ordem)
);

-- ============ Contrato ============

CREATE TABLE contrato (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id               UUID NOT NULL REFERENCES orgao(id),
  processo_id            UUID NOT NULL REFERENCES processo(id), -- gerado no cadastro
  numero                 VARCHAR(40) NOT NULL,
  fornecedor_id          UUID NOT NULL REFERENCES fornecedor(id), -- cadastro global
  licitacao_id           UUID REFERENCES licitacao(id),
  ata_id                 UUID REFERENCES ata_registro_precos(id),
  data_inicio            DATE NOT NULL,
  data_fim               DATE NOT NULL, -- vencido: alerta, sem bloqueio
  valor_total            NUMERIC(14,2) NOT NULL,
  fiscal_nome_matricula  VARCHAR(200), -- texto livre
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (orgao_id, numero),
  CHECK (data_fim >= data_inicio),
  CHECK (num_nonnulls(licitacao_id, ata_id) >= 1)
);
CREATE INDEX idx_contrato_orgao ON contrato(orgao_id);
CREATE INDEX idx_contrato_fornecedor ON contrato(fornecedor_id);

CREATE TABLE contrato_unidade (
  contrato_id UUID NOT NULL REFERENCES contrato(id),
  unidade_id  UUID NOT NULL REFERENCES unidade(id),
  PRIMARY KEY (contrato_id, unidade_id)
);

-- Dados complementares, N linhas opcionais por contrato.
CREATE TABLE dotacao_orcamentaria (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id           UUID NOT NULL REFERENCES contrato(id),
  orgao_codigo          VARCHAR(20),
  unidade_orcamentaria  VARCHAR(150),
  funcao_programatica   VARCHAR(150),
  natureza_despesa      VARCHAR(150),
  fonte_recurso         VARCHAR(100),
  valor                 NUMERIC(14,2)
);
CREATE INDEX idx_dotacao_contrato ON dotacao_orcamentaria(contrato_id);

-- ============ Item do contrato ============

CREATE TABLE item (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id            UUID NOT NULL REFERENCES orgao(id),
  contrato_id         UUID NOT NULL REFERENCES contrato(id),
  origem_ata_item_id  UUID REFERENCES ata_item(id), -- rastro da ata
  produto             VARCHAR(150) NOT NULL,
  descricao           TEXT,
  unidade_medida      VARCHAR(20) NOT NULL,
  marca               VARCHAR(100),
  quantidade_total    NUMERIC(14,3) NOT NULL,
  saldo_disponivel    NUMERIC(14,3) NOT NULL, -- reserva libera só por ação explícita
  modo_medicao        VARCHAR(12) NOT NULL
                        CHECK (modo_medicao IN ('UNIDADE', 'PERCENTUAL', 'VALOR')),
  valor_unitario      NUMERIC(14,4) NOT NULL,
  valor_total         NUMERIC(14,2) NOT NULL,
  CHECK (saldo_disponivel >= 0 AND saldo_disponivel <= quantidade_total)
);
CREATE INDEX idx_item_orgao ON item(orgao_id);
CREATE INDEX idx_item_contrato ON item(contrato_id);

-- Campos extras variáveis por contrato (ex: cronograma_entrega),
-- vindos da planilha importada com mapeamento pelo usuário.
CREATE TABLE contrato_campo_extra (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id  UUID NOT NULL REFERENCES contrato(id),
  nome         VARCHAR(60) NOT NULL,
  tipo_dado    VARCHAR(10) NOT NULL CHECK (tipo_dado IN ('TEXTO', 'NUMERO', 'DATA')),
  UNIQUE (contrato_id, nome)
);

CREATE TABLE item_valor_extra (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID NOT NULL REFERENCES item(id),
  campo_extra_id  UUID NOT NULL REFERENCES contrato_campo_extra(id),
  valor           TEXT,
  UNIQUE (item_id, campo_extra_id)
);

-- ============ Solicitação ============

-- Multi-contrato: cada item rastreia seu contrato via item_id.
-- Rascunho: sem números e sem reserva; ambos acontecem no envio.
-- Sem edição pós-envio: corrigir = cancelar (libera saldo) + refazer.
CREATE TABLE solicitacao (
  processo_id             UUID PRIMARY KEY REFERENCES processo(id),
  unidade_solicitante_id  UUID NOT NULL REFERENCES unidade(id),
  situacao                VARCHAR(10) NOT NULL DEFAULT 'RASCUNHO'
                            CHECK (situacao IN ('RASCUNHO', 'ENVIADA'))
);

CREATE TABLE solicitacao_item (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id         UUID NOT NULL REFERENCES solicitacao(processo_id),
  item_id                UUID NOT NULL REFERENCES item(id),
  quantidade_solicitada  NUMERIC(14,3) NOT NULL,
  valor_calculado        NUMERIC(14,2) NOT NULL
);
CREATE INDEX idx_solicitacao_item_solicitacao ON solicitacao_item(solicitacao_id);

-- Parecer da Controladoria: por processo inteiro, etapa final/aprovação.
CREATE TABLE parecer (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id    UUID NOT NULL REFERENCES processo(id),
  favoravel      BOOLEAN NOT NULL,
  justificativa  TEXT,
  usuario_id     UUID NOT NULL REFERENCES usuario(id),
  data           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_parecer_processo ON parecer(processo_id);

-- Uma ordem por contrato/fornecedor envolvido no processo.
-- NF única por fornecedor dentro da prefeitura (orgao/fornecedor denormalizados).
CREATE TABLE ordem_fornecimento (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id            UUID NOT NULL REFERENCES orgao(id),
  processo_id         UUID NOT NULL REFERENCES processo(id),
  contrato_id         UUID NOT NULL REFERENCES contrato(id),
  fornecedor_id       UUID NOT NULL REFERENCES fornecedor(id),
  numero              VARCHAR(20) NOT NULL, -- sequência própria
  dados_contratante   JSONB, -- nome, cnpj, endereco, inscricoes
  numero_empenho      VARCHAR(40),
  numero_requisicao   VARCHAR(40),
  projeto_atividade   VARCHAR(150),
  elemento_despesa    VARCHAR(150),
  fonte_recurso       VARCHAR(100),
  valor               NUMERIC(14,2) NOT NULL,
  numero_parcelas     INTEGER,
  numero_nota_fiscal  VARCHAR(40),
  data                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (orgao_id, numero),
  UNIQUE (orgao_id, fornecedor_id, numero_nota_fiscal)
);
CREATE INDEX idx_ordem_fornecimento_processo ON ordem_fornecimento(processo_id);
