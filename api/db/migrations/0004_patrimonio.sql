-- 0004 — Módulo controle de patrimônio. Depende de 0001_nucleo.sql
-- (usa local compartilhado) e de 0002 (remessa pode referenciar contrato/ordem).
-- Código de tombamento fixo: <codigo_local>-<sequencial por local>, ex 001-214.

CREATE TABLE categoria_bem (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id  UUID NOT NULL REFERENCES orgao(id), -- cadastrável por prefeitura
  nome      VARCHAR(100) NOT NULL,
  ativo     BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (orgao_id, nome)
);

CREATE TABLE remessa_patrimonio (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id               UUID NOT NULL REFERENCES orgao(id),
  data                   DATE NOT NULL,
  fornecedor_id          UUID REFERENCES fornecedor(id), -- opcional (doação/convênio sem)
  nota_fiscal            VARCHAR(40),
  contrato_id            UUID REFERENCES contrato(id), -- integração opcional com compras
  ordem_fornecimento_id  UUID REFERENCES ordem_fornecimento(id)
);
CREATE INDEX idx_remessa_patrimonio_orgao ON remessa_patrimonio(orgao_id);

-- Lançamento em lote: 400 cadeiras geram 400 bens individuais.
CREATE TABLE remessa_lote (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remessa_id        UUID NOT NULL REFERENCES remessa_patrimonio(id),
  categoria_id      UUID NOT NULL REFERENCES categoria_bem(id),
  local_destino_id  UUID NOT NULL REFERENCES local(id),
  nome_bem          VARCHAR(150) NOT NULL,
  quantidade        INTEGER NOT NULL CHECK (quantidade > 0)
);
CREATE INDEX idx_remessa_lote_remessa ON remessa_lote(remessa_id);

CREATE TABLE bem (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id             UUID NOT NULL REFERENCES orgao(id),
  codigo_tombamento    VARCHAR(20) NOT NULL, -- fixo desde o tombamento
  local_tombamento_id  UUID NOT NULL REFERENCES local(id), -- origem do código, nunca muda
  local_atual_id       UUID NOT NULL REFERENCES local(id),
  categoria_id         UUID NOT NULL REFERENCES categoria_bem(id),
  remessa_lote_id      UUID REFERENCES remessa_lote(id),
  nome                 VARCHAR(150) NOT NULL,
  estado_conservacao   VARCHAR(12) NOT NULL DEFAULT 'NOVO'
                         CHECK (estado_conservacao IN ('NOVO', 'BOM', 'DANIFICADO', 'EM_CONSERTO')),
  status               VARCHAR(10) NOT NULL DEFAULT 'ATIVO'
                         CHECK (status IN ('ATIVO', 'BAIXADO')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (orgao_id, codigo_tombamento)
);
CREATE INDEX idx_bem_orgao ON bem(orgao_id);
CREATE INDEX idx_bem_local_atual ON bem(local_atual_id);

-- Sequencial de tombamento por local.
CREATE TABLE local_tombamento_sequencia (
  local_id  UUID PRIMARY KEY REFERENCES local(id),
  contador  INTEGER NOT NULL DEFAULT 0
);

-- Transferência com aceite do destino; pendente até confirmação.
CREATE TABLE transferencia_bem (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bem_id                  UUID NOT NULL REFERENCES bem(id),
  local_origem_id         UUID NOT NULL REFERENCES local(id),
  local_destino_id        UUID NOT NULL REFERENCES local(id),
  enviado_por_usuario_id  UUID NOT NULL REFERENCES usuario(id),
  data_envio              TIMESTAMPTZ NOT NULL DEFAULT now(),
  aceito_por_usuario_id   UUID REFERENCES usuario(id),
  data_aceite             TIMESTAMPTZ,
  status                  VARCHAR(10) NOT NULL DEFAULT 'PENDENTE'
                            CHECK (status IN ('PENDENTE', 'ACEITA', 'RECUSADA'))
);
CREATE INDEX idx_transferencia_bem_bem ON transferencia_bem(bem_id);

-- Baixa formal: bem sai do ativo, permanece no histórico.
CREATE TABLE baixa_bem (
  bem_id      UUID PRIMARY KEY REFERENCES bem(id),
  motivo      VARCHAR(12) NOT NULL
                CHECK (motivo IN ('QUEBRADO', 'DOADO', 'EXTRAVIADO', 'LEILAO', 'OUTRO')),
  observacao  TEXT,
  usuario_id  UUID NOT NULL REFERENCES usuario(id),
  data        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conferência física periódica por local.
CREATE TABLE inventario (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id        UUID NOT NULL REFERENCES local(id),
  data_inicio     DATE NOT NULL,
  data_conclusao  DATE,
  status          VARCHAR(10) NOT NULL DEFAULT 'ABERTO'
                    CHECK (status IN ('ABERTO', 'CONCLUIDO'))
);
CREATE INDEX idx_inventario_local ON inventario(local_id);

CREATE TABLE inventario_item (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id     UUID NOT NULL REFERENCES inventario(id),
  bem_id            UUID NOT NULL REFERENCES bem(id),
  situacao          VARCHAR(15) NOT NULL
                      CHECK (situacao IN ('ENCONTRADO', 'NAO_ENCONTRADO')),
  estado_observado  VARCHAR(12)
                      CHECK (estado_observado IN ('NOVO', 'BOM', 'DANIFICADO', 'EM_CONSERTO')),
  observacao        TEXT,
  UNIQUE (inventario_id, bem_id)
);
