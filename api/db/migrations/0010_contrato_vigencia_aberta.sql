-- 0010 — Fim de vigência deixa de ser obrigatório no contrato.
-- Contrato sem data de fim vale por prazo indeterminado (ou prorrogação
-- automática, prevista na Lei 14.133/21 quando o objeto não é concluído).
-- O CHECK existente continua válido: comparação com NULL não reprova a linha.

ALTER TABLE contrato ALTER COLUMN data_fim DROP NOT NULL;
