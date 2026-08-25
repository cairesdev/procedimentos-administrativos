-- Protocolo vira sistema próprio, contratável como Frotas e Patrimônio.
--
-- Quem atende no balcão não precisa — e não deve — enxergar licitação,
-- contrato e solicitação. Separar o módulo é o que permite entregar ao
-- atendente só a tela dele.

ALTER TABLE orgao_modulo DROP CONSTRAINT IF EXISTS orgao_modulo_modulo_check;
ALTER TABLE orgao_modulo
  ADD CONSTRAINT orgao_modulo_modulo_check
  CHECK (modulo IN ('PROCESSOS', 'FROTAS', 'PATRIMONIO', 'ALMOXARIFADO', 'PROTOCOLO'));

-- Prefeitura que já usa Processos ganha Protocolo habilitado: o atendimento
-- externo nasceu dentro de Processos e continuaria funcionando lá. Sem isto,
-- a separação tiraria do ar um recurso que já estava em uso.
INSERT INTO orgao_modulo (orgao_id, modulo, ativo)
SELECT orgao_id, 'PROTOCOLO', TRUE
  FROM orgao_modulo
 WHERE modulo = 'PROCESSOS' AND ativo
ON CONFLICT (orgao_id, modulo) DO NOTHING;
