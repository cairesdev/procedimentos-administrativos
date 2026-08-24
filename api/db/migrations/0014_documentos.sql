-- Documentos emitidos: modelo por módulo, editável pela prefeitura.
--
-- O padrão de cada peça é uma linha com orgao_id NULL — o modelo GLOBAL,
-- mantido pelo painel do produto. A prefeitura que precisa de outra redação
-- ganha uma linha própria, que vence sobre a global na resolução. Quem não
-- mexeu segue a global, então corrigir a redação é um UPDATE só, não um por
-- prefeitura. "Restaurar padrão" é apagar a linha da prefeitura.

CREATE TABLE documento_modelo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id    UUID REFERENCES orgao(id), -- NULL = modelo global do produto
  modulo      VARCHAR(30) NOT NULL
                CHECK (modulo IN ('PROCESSOS', 'PATRIMONIO', 'FROTAS', 'ALMOXARIFADO')),
  tipo        VARCHAR(40) NOT NULL,
  nome        VARCHAR(150) NOT NULL, -- rótulo do botão de emissão
  titulo      VARCHAR(150) NOT NULL, -- cabeçalho impresso na peça
  corpo       TEXT NOT NULL,         -- HTML restrito com marcadores {{...}}
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Um global por tipo e um da prefeitura por tipo. Sem os índices parciais,
-- duas linhas globais do mesmo tipo tornariam a resolução ambígua.
CREATE UNIQUE INDEX idx_documento_modelo_global
  ON documento_modelo (tipo) WHERE orgao_id IS NULL;
CREATE UNIQUE INDEX idx_documento_modelo_orgao
  ON documento_modelo (orgao_id, tipo) WHERE orgao_id IS NOT NULL;
CREATE INDEX idx_documento_modelo_modulo ON documento_modelo (modulo);

-- ---------------------------------------------------------------------------
-- documento_emitido nasceu em 0001 pensando em guardar arquivo. A decisão foi
-- outra: guarda-se o RETRATO — o corpo já interpolado e os dados usados. Assim
-- a peça é remontada idêntica anos depois, sem PDF no storage, e editar o
-- modelo depois não reescreve documento já emitido.

ALTER TABLE documento_emitido
  ALTER COLUMN arquivo DROP NOT NULL;

ALTER TABLE documento_emitido
  ADD COLUMN modelo_id              UUID REFERENCES documento_modelo(id),
  ADD COLUMN titulo                 VARCHAR(150) NOT NULL DEFAULT '',
  ADD COLUMN corpo                  TEXT NOT NULL DEFAULT '',
  ADD COLUMN dados                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN emitido_por_usuario_id UUID REFERENCES usuario(id),
  -- Autoria congelada: o servidor pode mudar de setor ou sair da prefeitura,
  -- e a peça precisa continuar dizendo quem a assinou naquele dia.
  ADD COLUMN emitido_por_nome       VARCHAR(150) NOT NULL DEFAULT '',
  ADD COLUMN emitido_por_cargo      VARCHAR(150) NOT NULL DEFAULT '',
  ADD COLUMN cancelado_em           TIMESTAMPTZ,
  ADD COLUMN cancelado_motivo       TEXT;

-- Os defaults existem só para a alteração passar em base com linha antiga;
-- daqui para frente todo campo é preenchido na emissão.
ALTER TABLE documento_emitido
  ALTER COLUMN titulo DROP DEFAULT,
  ALTER COLUMN corpo DROP DEFAULT,
  ALTER COLUMN dados DROP DEFAULT,
  ALTER COLUMN emitido_por_nome DROP DEFAULT,
  ALTER COLUMN emitido_por_cargo DROP DEFAULT;

-- O código verificador vai numa página pública, sem prefeitura na URL: tem de
-- ser único no produto inteiro, não dentro do órgão.
ALTER TABLE documento_emitido
  DROP CONSTRAINT IF EXISTS documento_emitido_orgao_id_codigo_key;
CREATE UNIQUE INDEX idx_documento_emitido_codigo ON documento_emitido (codigo);
