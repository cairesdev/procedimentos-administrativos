-- 0039 — Número de licitação, contrato e ata pode repetir.
--
-- A trava `UNIQUE (orgao_id, numero)` presumia que o número identifica o
-- registro dentro da prefeitura. Não identifica: a numeração reinicia a cada
-- exercício, o mesmo "025/2026" volta em 2027, e o número de uma ata carrega o
-- do órgão que a gerou — numa adesão, dois órgãos diferentes trazem numerações
-- que se cruzam. Recusar o cadastro obrigava o servidor a inventar um sufixo
-- que não existe no papel, e aí o sistema deixa de bater com o processo físico.
--
-- Quem identifica continua sendo o `id`. O número volta a ser o que sempre foi:
-- o rótulo que a prefeitura usa para se referir ao registro.
--
-- Os índices ficam — sem o UNIQUE, mas ainda úteis: buscar contrato pelo número
-- é o caminho mais percorrido da tela de solicitação.

ALTER TABLE licitacao            DROP CONSTRAINT licitacao_orgao_id_numero_key;
ALTER TABLE ata_registro_precos  DROP CONSTRAINT ata_registro_precos_orgao_id_numero_key;
ALTER TABLE contrato             DROP CONSTRAINT contrato_orgao_id_numero_key;

CREATE INDEX idx_licitacao_numero ON licitacao(orgao_id, numero);
CREATE INDEX idx_ata_numero       ON ata_registro_precos(orgao_id, numero);
CREATE INDEX idx_contrato_numero  ON contrato(orgao_id, numero);
