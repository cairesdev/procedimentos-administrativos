-- 0011 — Papel de quem cuida do patrimônio, no catálogo fixo de papéis.

ALTER TABLE usuario DROP CONSTRAINT usuario_papel_base_check;

ALTER TABLE usuario ADD CONSTRAINT usuario_papel_base_check
  CHECK (papel_base IN (
    'ADMIN', 'GESTOR', 'SERVIDOR', 'PROTOCOLO',
    'COMPRAS', 'CONTROLADORIA', 'NUTRICIONISTA', 'PATRIMONIO'
  ));
