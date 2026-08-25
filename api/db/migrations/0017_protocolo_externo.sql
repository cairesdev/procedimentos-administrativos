-- Protocolo externo: atendimento de balcão e consulta pública.
--
-- O núcleo já previa isto desde 0001 (`requerente`, `processo.requerente_id`,
-- tipo ATENDIMENTO_EXTERNO, anexo enviado por requerente). O que falta é o
-- assunto — a lista do que a prefeitura atende — e o resumo do pedido.

CREATE TABLE assunto_protocolo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id    UUID NOT NULL REFERENCES orgao(id),
  nome        VARCHAR(150) NOT NULL,
  descricao   TEXT,
  -- Setor que resolve. O processo nasce nele, sem triagem manual; nulo cai na
  -- primeira etapa do fluxo de ATENDIMENTO_EXTERNO, se houver.
  setor_id    UUID REFERENCES setor(id),
  prazo_dias  INTEGER CHECK (prazo_dias IS NULL OR prazo_dias > 0),
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (orgao_id, nome)
);
CREATE INDEX idx_assunto_protocolo_orgao ON assunto_protocolo(orgao_id);

ALTER TABLE processo
  ADD COLUMN assunto_id UUID REFERENCES assunto_protocolo(id),
  -- O que o requerente pediu, nas palavras dele. O assunto classifica; isto
  -- descreve o caso concreto.
  ADD COLUMN descricao_pedido TEXT,
  -- Onde o atendimento entrou. Balcão e portal contam separado no relatório,
  -- e o portal precisa de tratamento diferente em caso de abuso.
  ADD COLUMN origem_atendimento VARCHAR(15)
    CHECK (origem_atendimento IS NULL OR origem_atendimento IN ('BALCAO', 'PORTAL'));

CREATE INDEX idx_processo_assunto ON processo(assunto_id);

-- A consulta pública casa protocolo + documento do requerente. Sem este
-- índice, cada tentativa varreria a tabela — e é rota aberta na internet,
-- onde tentativa em massa é o cenário normal, não a exceção.
CREATE INDEX idx_processo_requerente ON processo(requerente_id);
