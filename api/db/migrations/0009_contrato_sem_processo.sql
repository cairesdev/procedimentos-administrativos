-- 0009 — Contrato deixa de abrir processo administrativo.
-- Decisão do cliente: número de protocolo e de processo administrativo só
-- nascem na solicitação. Licitação, ata e contrato são cadastros de base.

ALTER TABLE contrato ALTER COLUMN processo_id DROP NOT NULL;

-- Cancela e desvincula os processos que contratos criaram enquanto a regra
-- anterior valia; a numeração fica registrada apenas no histórico.
UPDATE processo
   SET status = 'CANCELADO', data_encerramento = now()
 WHERE tipo_processo = 'CONTRATO' AND status <> 'CANCELADO';

UPDATE contrato SET processo_id = NULL WHERE processo_id IS NOT NULL;
