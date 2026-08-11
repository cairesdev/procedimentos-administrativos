-- 0001 — Núcleo: tenant, módulos habilitados, organização, usuários,
-- fornecedor global, requerentes, numeração, documentos emitidos e auditoria.
-- Multi-tenant: banco único, isolamento por orgao_id.
-- REGRA: toda query de tenant filtra por orgao_id (filhas via join na pai).
-- Exceção deliberada: fornecedor é cadastro GLOBAL, sem orgao_id.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ Tenant e módulos ============

CREATE TABLE orgao (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj        VARCHAR(14) NOT NULL UNIQUE,
  nome        VARCHAR(200) NOT NULL,
  uf          CHAR(2) NOT NULL,
  municipio   VARCHAR(120) NOT NULL,
  endereco    TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitação de módulos por prefeitura, controlada pelo super admin.
CREATE TABLE orgao_modulo (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id         UUID NOT NULL REFERENCES orgao(id),
  modulo           VARCHAR(30) NOT NULL
                     CHECK (modulo IN ('PROCESSOS', 'FROTAS', 'PATRIMONIO', 'ALMOXARIFADO')),
  ativo            BOOLEAN NOT NULL DEFAULT TRUE,
  data_ativacao    TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_desativacao TIMESTAMPTZ,
  UNIQUE (orgao_id, modulo)
);
CREATE INDEX idx_orgao_modulo_orgao ON orgao_modulo(orgao_id);

-- Timbragem aplicada a todos os documentos emitidos pela prefeitura.
CREATE TABLE orgao_documento_config (
  orgao_id           UUID PRIMARY KEY REFERENCES orgao(id),
  arquivo_logomarca  VARCHAR(255),
  cabecalho_timbre   TEXT,
  rodape_timbre      TEXT
);

-- ============ Organização ============

CREATE TABLE unidade (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id    UUID NOT NULL REFERENCES orgao(id),
  nome        VARCHAR(150) NOT NULL,
  sigla       VARCHAR(20),
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_unidade_orgao ON unidade(orgao_id);

-- Setor funcional independente de unidade (duas hierarquias paralelas).
CREATE TABLE setor (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id    UUID NOT NULL REFERENCES orgao(id),
  nome        VARCHAR(150) NOT NULL,
  tipo        VARCHAR(30) NOT NULL
                CHECK (tipo IN ('PROTOCOLO', 'COMPRAS', 'CONTROLADORIA',
                                'ALIMENTACAO_ESCOLAR', 'FROTAS', 'PATRIMONIO', 'OPERACIONAL')),
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_setor_orgao ON setor(orgao_id);

-- Departamento é endereçável no fluxo: destino granular com fila própria.
CREATE TABLE departamento (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id               UUID NOT NULL REFERENCES setor(id),
  nome                   VARCHAR(150) NOT NULL,
  categoria_atendimento  VARCHAR(100),
  ativo                  BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_departamento_setor ON departamento(setor_id);

-- Local físico compartilhado entre módulos (patrimônio, almoxarifado).
-- Pode reaproveitar uma unidade ou ser avulso (escola, hospital).
CREATE TABLE local (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id    UUID NOT NULL REFERENCES orgao(id),
  unidade_id  UUID REFERENCES unidade(id),
  codigo      VARCHAR(10) NOT NULL,
  nome        VARCHAR(150) NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (orgao_id, codigo)
);
CREATE INDEX idx_local_orgao ON local(orgao_id);

-- ============ Usuários ============

CREATE TABLE usuario (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id    UUID NOT NULL REFERENCES orgao(id),
  nome        VARCHAR(150) NOT NULL,
  email       VARCHAR(150) NOT NULL,
  senha_hash  VARCHAR(255) NOT NULL,
  papel_base  VARCHAR(20) NOT NULL
                CHECK (papel_base IN ('ADMIN', 'GESTOR', 'SERVIDOR', 'PROTOCOLO',
                                      'COMPRAS', 'CONTROLADORIA', 'NUTRICIONISTA')),
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (orgao_id, email)
);
CREATE INDEX idx_usuario_orgao ON usuario(orgao_id);

CREATE TABLE usuario_permissao (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuario(id),
  permissao   VARCHAR(80) NOT NULL,
  concedida   BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (usuario_id, permissao)
);

-- Lotações múltiplas: exatamente um destino (unidade, setor ou departamento).
-- Cada ação no sistema registra em nome de qual lotação o usuário agiu.
CREATE TABLE lotacao (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       UUID NOT NULL REFERENCES usuario(id),
  unidade_id       UUID REFERENCES unidade(id),
  setor_id         UUID REFERENCES setor(id),
  departamento_id  UUID REFERENCES departamento(id),
  ativo            BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (num_nonnulls(unidade_id, setor_id, departamento_id) = 1)
);
CREATE INDEX idx_lotacao_usuario ON lotacao(usuario_id);

-- ============ Fornecedor global e requerentes ============

-- GLOBAL: sem orgao_id. Editável por qualquer prefeitura e pelo próprio
-- fornecedor via link externo; toda alteração gera histórico.
CREATE TABLE fornecedor (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento            VARCHAR(14) NOT NULL UNIQUE,
  razao_social         VARCHAR(200) NOT NULL,
  endereco             TEXT,
  email                VARCHAR(150),
  telefone             VARCHAR(20),
  inscricao_estadual   VARCHAR(30),
  inscricao_municipal  VARCHAR(30),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fornecedor_historico (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id    UUID NOT NULL REFERENCES fornecedor(id),
  alterado_por     VARCHAR(120) NOT NULL, -- usuario:<id> | link_externo | orgao:<id>
  dados_anteriores JSONB NOT NULL,
  data             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fornecedor_historico_fornecedor ON fornecedor_historico(fornecedor_id);

CREATE TABLE requerente (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id          UUID NOT NULL REFERENCES orgao(id),
  tipo              VARCHAR(20) NOT NULL
                      CHECK (tipo IN ('FORNECEDOR', 'CIDADAO', 'OUTRO_ORGAO', 'SERVIDOR')),
  fornecedor_id     UUID REFERENCES fornecedor(id),
  documento         VARCHAR(20) NOT NULL,
  nome              VARCHAR(200) NOT NULL,
  contato_email     VARCHAR(150),
  contato_telefone  VARCHAR(20),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (orgao_id, documento),
  CHECK (tipo <> 'FORNECEDOR' OR fornecedor_id IS NOT NULL)
);
CREATE INDEX idx_requerente_orgao ON requerente(orgao_id);

-- ============ Numeração, documentos e auditoria ============

-- Sequências separadas por tipo, reiniciando por ano (ex: 000123/2026).
CREATE TABLE numeracao_sequencia (
  orgao_id  UUID NOT NULL REFERENCES orgao(id),
  tipo      VARCHAR(40) NOT NULL, -- PROTOCOLO | PROCESSO_ADM | ORDEM_FORNECIMENTO | ...
  ano       INTEGER NOT NULL,
  contador  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (orgao_id, tipo, ano)
);

-- Transversal: comprovantes, declarações e relatórios de todos os módulos.
-- codigo é pesquisável e codificado em QR interno para localização.
CREATE TABLE documento_emitido (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id       UUID NOT NULL REFERENCES orgao(id),
  modulo         VARCHAR(30) NOT NULL,
  tipo           VARCHAR(40) NOT NULL,
  codigo         VARCHAR(60) NOT NULL,
  referencia_id  UUID NOT NULL,
  arquivo        VARCHAR(255) NOT NULL,
  data           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (orgao_id, codigo)
);
CREATE INDEX idx_documento_emitido_orgao ON documento_emitido(orgao_id);
CREATE INDEX idx_documento_emitido_referencia ON documento_emitido(referencia_id);

-- Só eventos de negócio relevantes (despacho, parecer, cancelamento,
-- aprovação, mudança de setor) — não toda edição de cadastro.
CREATE TABLE auditoria_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id     UUID NOT NULL REFERENCES orgao(id),
  usuario_id   UUID REFERENCES usuario(id),
  tipo_evento  VARCHAR(60) NOT NULL,
  referencia_id UUID,
  detalhes     JSONB,
  data         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auditoria_orgao ON auditoria_log(orgao_id);
CREATE INDEX idx_auditoria_referencia ON auditoria_log(referencia_id);
