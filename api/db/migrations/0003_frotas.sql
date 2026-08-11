-- 0003 — Módulo controle de frotas. Depende de 0001_nucleo.sql.
-- Fluxo próprio: SOLICITADA -> APROVADA/RECUSADA/REMARCADA -> RETIRADA -> FINALIZADA.
-- Conflito de agenda só avisa; gestor decide.

CREATE TABLE frota_config (
  orgao_id                       UUID PRIMARY KEY REFERENCES orgao(id),
  compartilha_entre_secretarias  BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE veiculo (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id             UUID NOT NULL REFERENCES orgao(id),
  unidade_id           UUID REFERENCES unidade(id), -- nulo = frota central
  placa                VARCHAR(10) NOT NULL,
  ano                  INTEGER,
  modelo               VARCHAR(100) NOT NULL,
  tipo                 VARCHAR(40),
  quilometragem_atual  NUMERIC(10,1) NOT NULL DEFAULT 0, -- atualizada na finalização
  ativo                BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (orgao_id, placa)
);
CREATE INDEX idx_veiculo_orgao ON veiculo(orgao_id);

CREATE TABLE motorista (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id       UUID NOT NULL REFERENCES orgao(id),
  usuario_id     UUID REFERENCES usuario(id), -- vínculo opcional
  nome           VARCHAR(150) NOT NULL,
  cnh            VARCHAR(20) NOT NULL,
  categoria_cnh  VARCHAR(5) NOT NULL,
  validade_cnh   DATE NOT NULL, -- alerta de vencimento
  ativo          BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_motorista_orgao ON motorista(orgao_id);

CREATE TABLE viagem (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id                UUID NOT NULL REFERENCES orgao(id),
  unidade_solicitante_id  UUID NOT NULL REFERENCES unidade(id),
  veiculo_id              UUID NOT NULL REFERENCES veiculo(id),
  motorista_id            UUID NOT NULL REFERENCES motorista(id),
  data_hora_desejada      TIMESTAMPTZ NOT NULL,
  data_hora_remarcada     TIMESTAMPTZ, -- proposta pelo gestor
  motivo                  TEXT NOT NULL,
  responsavel             VARCHAR(150) NOT NULL,
  status                  VARCHAR(15) NOT NULL DEFAULT 'SOLICITADA'
                            CHECK (status IN ('SOLICITADA', 'APROVADA', 'RECUSADA', 'REMARCADA',
                                              'RETIRADA', 'FINALIZADA', 'CANCELADA')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_viagem_orgao ON viagem(orgao_id);
CREATE INDEX idx_viagem_veiculo ON viagem(veiculo_id);

CREATE TABLE retirada (
  viagem_id                    UUID PRIMARY KEY REFERENCES viagem(id),
  km_inicial                   NUMERIC(10,1) NOT NULL,
  data_hora                    TIMESTAMPTZ NOT NULL,
  motorista_id                 UUID NOT NULL REFERENCES motorista(id), -- confirmado
  nota_combustivel_tipo        VARCHAR(6) CHECK (nota_combustivel_tipo IN ('LITRO', 'VALOR')),
  nota_combustivel_quantidade  NUMERIC(10,2)
);

CREATE TABLE abastecimento (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viagem_id  UUID NOT NULL REFERENCES viagem(id),
  data       TIMESTAMPTZ NOT NULL,
  litros     NUMERIC(8,2),
  valor      NUMERIC(10,2)
);
CREATE INDEX idx_abastecimento_viagem ON abastecimento(viagem_id);

CREATE TABLE finalizacao (
  viagem_id  UUID PRIMARY KEY REFERENCES viagem(id),
  data_hora  TIMESTAMPTZ NOT NULL,
  km_final   NUMERIC(10,1) NOT NULL,
  sinistro   TEXT -- texto livre, opcional
);

-- Manutenção aberta (data_fim nula) = veículo indisponível.
CREATE TABLE manutencao (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id   UUID NOT NULL REFERENCES veiculo(id),
  tipo         VARCHAR(12) NOT NULL CHECK (tipo IN ('PREVENTIVA', 'CORRETIVA')),
  data_inicio  DATE NOT NULL,
  data_fim     DATE,
  descricao    TEXT,
  custo        NUMERIC(12,2),
  oficina      VARCHAR(150)
);
CREATE INDEX idx_manutencao_veiculo ON manutencao(veiculo_id);
