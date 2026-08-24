-- 0013 — Data de criação da solicitação.
-- O rascunho nasce antes do processo, e o processo é quem tinha data. Sem esta
-- coluna, um rascunho não tem quando na listagem.

ALTER TABLE solicitacao
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Quem já foi enviada herda a abertura do processo, que é a data real.
UPDATE solicitacao s
   SET created_at = p.data_abertura
  FROM processo p
 WHERE p.id = s.processo_id;
