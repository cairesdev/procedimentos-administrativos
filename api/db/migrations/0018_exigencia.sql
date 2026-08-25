-- Exigência: o setor pergunta, o requerente responde.
--
-- Sem isto, pedido que chega incompleto só tem dois caminhos — indeferir ou
-- telefonar. A exigência deixa o processo visivelmente parado esperando o
-- cidadão, e não o servidor, o que muda quem está devendo resposta.

CREATE TABLE exigencia (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id               UUID NOT NULL REFERENCES orgao(id),
  processo_id            UUID NOT NULL REFERENCES processo(id),
  texto                  TEXT NOT NULL,
  prazo_dias             INTEGER CHECK (prazo_dias IS NULL OR prazo_dias > 0),
  -- Calculado na criação e congelado: mudar o prazo padrão do assunto depois
  -- não pode encurtar retroativamente o prazo de quem já foi notificado.
  prazo_limite           DATE,
  status                 VARCHAR(15) NOT NULL DEFAULT 'PENDENTE'
                           CHECK (status IN ('PENDENTE', 'RESPONDIDA', 'CANCELADA')),
  criada_por_usuario_id  UUID NOT NULL REFERENCES usuario(id),
  criada_em              TIMESTAMPTZ NOT NULL DEFAULT now(),
  resposta_texto         TEXT,
  respondida_em          TIMESTAMPTZ,
  cancelada_motivo       TEXT,
  -- Resposta e data andam juntas: uma sem a outra seria estado impossível.
  CHECK ((resposta_texto IS NULL) = (respondida_em IS NULL)),
  CHECK (status <> 'RESPONDIDA' OR respondida_em IS NOT NULL)
);

CREATE INDEX idx_exigencia_processo ON exigencia(processo_id);
CREATE INDEX idx_exigencia_orgao ON exigencia(orgao_id);

-- Uma exigência pendente por processo: duas perguntas abertas ao mesmo tempo
-- deixariam o requerente sem saber a qual está respondendo, e o servidor sem
-- saber qual foi respondida.
CREATE UNIQUE INDEX idx_exigencia_pendente_unica
  ON exigencia (processo_id) WHERE status = 'PENDENTE';

-- O anexo do requerente pode responder a uma exigência específica. Nulo =
-- documento enviado por iniciativa própria.
ALTER TABLE anexo
  ADD COLUMN exigencia_id UUID REFERENCES exigencia(id);
