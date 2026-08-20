-- 0012 — Papel de quem cuida da frota, no catálogo fixo de papéis.

ALTER TABLE usuario DROP CONSTRAINT usuario_papel_base_check;

ALTER TABLE usuario ADD CONSTRAINT usuario_papel_base_check
  CHECK (papel_base IN (
    'ADMIN', 'GESTOR', 'SERVIDOR', 'PROTOCOLO',
    'COMPRAS', 'CONTROLADORIA', 'NUTRICIONISTA', 'PATRIMONIO', 'FROTAS'
  ));

-- Toda prefeitura com o módulo tem uma linha de configuração; sem ela o
-- compartilhamento entre secretarias ficaria indefinido na primeira consulta.
INSERT INTO frota_config (orgao_id, compartilha_entre_secretarias)
SELECT o.id, FALSE FROM orgao o
ON CONFLICT (orgao_id) DO NOTHING;
