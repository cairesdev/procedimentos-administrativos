-- 0005 — Módulo almoxarifado / alimentação escolar. Depende de 0001_nucleo.sql.
-- Estoque genérico com tipos personalizáveis; FEFO sugerido com ajuste manual;
-- validade só alerta, nunca bloqueia; comprovantes via documento_emitido (0001).

CREATE TABLE almoxarifado (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id  UUID NOT NULL REFERENCES orgao(id), -- N por prefeitura
  nome      VARCHAR(150) NOT NULL,
  ativo     BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_almoxarifado_orgao ON almoxarifado(orgao_id);

-- Escola/hospital (local compartilhado) vinculado a um almoxarifado.
ALTER TABLE local ADD COLUMN almoxarifado_id UUID REFERENCES almoxarifado(id);

CREATE TABLE tipo_estoque (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id  UUID NOT NULL REFERENCES orgao(id), -- categoria personalizável
  nome      VARCHAR(100) NOT NULL, -- alimentação escolar, limpeza...
  ativo     BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (orgao_id, nome)
);

-- Produto agregador: saldo total de "sal" soma lotes de várias remessas.
CREATE TABLE produto (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id        UUID NOT NULL REFERENCES orgao(id),
  nome            VARCHAR(150) NOT NULL,
  unidade_medida  VARCHAR(20) NOT NULL, -- KG, LITRO, PCT...
  UNIQUE (orgao_id, nome, unidade_medida)
);

CREATE TABLE remessa_estoque (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  almoxarifado_id   UUID NOT NULL REFERENCES almoxarifado(id),
  codigo            VARCHAR(30) NOT NULL, -- pesquisável
  titulo            VARCHAR(200) NOT NULL,
  data              DATE NOT NULL,
  local_armazenado  VARCHAR(150),
  tipo_estoque_id   UUID NOT NULL REFERENCES tipo_estoque(id),
  UNIQUE (almoxarifado_id, codigo)
);
CREATE INDEX idx_remessa_estoque_almox ON remessa_estoque(almoxarifado_id);

-- Lote: entrada por planilha (ID, NOME, UNIDADE, QUANTIDADE, DATA_VALIDADE) ou manual.
CREATE TABLE lote (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remessa_id     UUID NOT NULL REFERENCES remessa_estoque(id),
  produto_id     UUID NOT NULL REFERENCES produto(id),
  quantidade     NUMERIC(14,3) NOT NULL,
  saldo          NUMERIC(14,3) NOT NULL,
  data_validade  DATE, -- opcional; alerta sem bloqueio
  CHECK (saldo >= 0 AND saldo <= quantidade)
);
CREATE INDEX idx_lote_remessa ON lote(remessa_id);
CREATE INDEX idx_lote_produto ON lote(produto_id);

-- Reserva com expiração configurável (liga/desliga + prazo) — diferente do
-- módulo de processos: aqui, expirada, o saldo volta sozinho.
CREATE TABLE solicitacao_estoque (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_solicitante_id  UUID NOT NULL REFERENCES local(id),
  autor_usuario_id      UUID NOT NULL REFERENCES usuario(id), -- inclui nutricionista
  tipo_estoque_id       UUID REFERENCES tipo_estoque(id), -- filtro por categoria
  status                VARCHAR(12) NOT NULL DEFAULT 'SOLICITADA'
                          CHECK (status IN ('SOLICITADA', 'LIBERADA', 'EM_TRANSITO',
                                            'RECEBIDA', 'RECUSADA', 'CANCELADA', 'EXPIRADA')),
  reserva_expira_em     TIMESTAMPTZ, -- nula = sem expiração
  data                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_solicitacao_estoque_local ON solicitacao_estoque(local_solicitante_id);

CREATE TABLE solicitacao_estoque_item (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id              UUID NOT NULL REFERENCES solicitacao_estoque(id),
  produto_id                  UUID NOT NULL REFERENCES produto(id),
  quantidade_solicitada       NUMERIC(14,3) NOT NULL, -- gera reserva
  saldo_da_unidade_no_momento NUMERIC(14,3), -- exibido ao responsável na liberação
  quantidade_liberada         NUMERIC(14,3), -- decisão do responsável
  quantidade_recebida         NUMERIC(14,3)  -- confirmação da unidade, pode divergir
);
CREATE INDEX idx_sol_estoque_item_sol ON solicitacao_estoque_item(solicitacao_id);

-- De quais lotes sai cada item liberado (FEFO sugerido, ajustável).
-- Multi-remessa discriminada no comprovante.
CREATE TABLE liberacao_lote (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_item_id  UUID NOT NULL REFERENCES solicitacao_estoque_item(id),
  lote_id              UUID NOT NULL REFERENCES lote(id),
  quantidade           NUMERIC(14,3) NOT NULL
);
CREATE INDEX idx_liberacao_lote_item ON liberacao_lote(solicitacao_item_id);

-- Saldo por produto na unidade (alimentado por recebimentos, reduzido por consumo/devolução).
CREATE TABLE estoque_local (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id    UUID NOT NULL REFERENCES local(id),
  produto_id  UUID NOT NULL REFERENCES produto(id),
  saldo       NUMERIC(14,3) NOT NULL DEFAULT 0,
  UNIQUE (local_id, produto_id)
);

CREATE TABLE consumo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id        UUID NOT NULL REFERENCES local(id),
  produto_id      UUID NOT NULL REFERENCES produto(id),
  quantidade      NUMERIC(14,3) NOT NULL,
  forma           VARCHAR(20) NOT NULL
                    CHECK (forma IN ('ITEM_A_ITEM', 'DECLARACAO_PERIODICA')),
  periodo_inicio  DATE, -- quando declaração periódica
  periodo_fim     DATE,
  data            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_consumo_local ON consumo(local_id);

-- Devolução volta ao estoque somente após aceite do almoxarifado.
CREATE TABLE devolucao (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id               UUID NOT NULL REFERENCES local(id),
  almoxarifado_id        UUID NOT NULL REFERENCES almoxarifado(id),
  produto_id             UUID NOT NULL REFERENCES produto(id),
  quantidade             NUMERIC(14,3) NOT NULL,
  status                 VARCHAR(10) NOT NULL DEFAULT 'PENDENTE'
                           CHECK (status IN ('PENDENTE', 'ACEITA', 'RECUSADA')),
  aceito_por_usuario_id  UUID REFERENCES usuario(id),
  data                   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_devolucao_almox ON devolucao(almoxarifado_id);

CREATE TABLE transferencia_almoxarifado (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  almoxarifado_origem_id   UUID NOT NULL REFERENCES almoxarifado(id),
  almoxarifado_destino_id  UUID NOT NULL REFERENCES almoxarifado(id),
  lote_id                  UUID NOT NULL REFERENCES lote(id),
  quantidade               NUMERIC(14,3) NOT NULL,
  usuario_id               UUID NOT NULL REFERENCES usuario(id),
  data                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ajuste por contagem física: perda, avaria, vencido, erro de lançamento.
CREATE TABLE ajuste_estoque (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  almoxarifado_id  UUID NOT NULL REFERENCES almoxarifado(id),
  lote_id          UUID NOT NULL REFERENCES lote(id),
  saldo_anterior   NUMERIC(14,3) NOT NULL,
  saldo_corrigido  NUMERIC(14,3) NOT NULL,
  motivo           VARCHAR(20) NOT NULL
                     CHECK (motivo IN ('PERDA', 'AVARIA', 'VENCIDO', 'ERRO_LANCAMENTO')),
  usuario_id       UUID NOT NULL REFERENCES usuario(id),
  data             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ajuste_estoque_almox ON ajuste_estoque(almoxarifado_id);
