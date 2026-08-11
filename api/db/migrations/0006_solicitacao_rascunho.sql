-- 0006 — Rascunho de solicitação sem processo.
-- Decisão do levantamento: números e reserva só no envio. Logo o rascunho
-- não pode depender de processo_id como PK. A solicitação ganha id próprio,
-- processo_id vira opcional (preenchido no envio) e orgao_id entra direto
-- para manter o isolamento de tenant nos rascunhos.

ALTER TABLE solicitacao_item
  DROP CONSTRAINT solicitacao_item_solicitacao_id_fkey;

ALTER TABLE solicitacao
  DROP CONSTRAINT solicitacao_pkey;

ALTER TABLE solicitacao
  ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN orgao_id UUID REFERENCES orgao(id),
  ALTER COLUMN processo_id DROP NOT NULL;

UPDATE solicitacao s
   SET orgao_id = p.orgao_id
  FROM processo p
 WHERE p.id = s.processo_id;

ALTER TABLE solicitacao
  ALTER COLUMN orgao_id SET NOT NULL,
  ADD PRIMARY KEY (id),
  ADD CONSTRAINT solicitacao_processo_unique UNIQUE (processo_id),
  ADD CONSTRAINT solicitacao_enviada_tem_processo
    CHECK (situacao = 'RASCUNHO' OR processo_id IS NOT NULL);

UPDATE solicitacao_item si
   SET solicitacao_id = s.id
  FROM solicitacao s
 WHERE s.processo_id = si.solicitacao_id;

ALTER TABLE solicitacao_item
  ADD CONSTRAINT solicitacao_item_solicitacao_id_fkey
    FOREIGN KEY (solicitacao_id) REFERENCES solicitacao(id);

CREATE INDEX idx_solicitacao_orgao ON solicitacao(orgao_id);
