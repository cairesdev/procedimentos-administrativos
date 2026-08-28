-- 0027 — Documento amarrado ao setor, e a segunda logomarca do timbre.
--
-- Três recortes de documento passam a conviver: o global do produto, o da
-- prefeitura (que já existiam, resolvidos por `orgao_id`) e agora o do setor —
-- o parecer que só a controladoria emite, a ordem que só compras emite.

-- O vínculo é com o TIPO do setor, não com a linha da tabela `setor`.
--
-- Um modelo global tem `orgao_id NULL` e precisa valer em toda prefeitura;
-- apontar para o setor de Compras de Alto Parnaíba o deixaria inútil nas
-- demais. O tipo ('COMPRAS', 'CONTROLADORIA'…) é o mesmo vocabulário em todas.
CREATE TABLE documento_modelo_setor (
  modelo_id  UUID NOT NULL REFERENCES documento_modelo(id) ON DELETE CASCADE,
  tipo_setor VARCHAR(30) NOT NULL
               CHECK (tipo_setor IN ('PROTOCOLO', 'COMPRAS', 'CONTROLADORIA',
                                     'ALIMENTACAO_ESCOLAR', 'FROTAS',
                                     'PATRIMONIO', 'OPERACIONAL')),
  PRIMARY KEY (modelo_id, tipo_setor)
);

-- A resolução do modelo passa por aqui em toda emissão.
CREATE INDEX idx_documento_modelo_setor_modelo ON documento_modelo_setor(modelo_id);

-- Sem linha nenhuma, o modelo continua valendo para todo mundo: é o
-- comportamento de hoje, e é o que mantém os 20 modelos já semeados no ar.
COMMENT ON TABLE documento_modelo_setor IS
  'Setores que alcançam o modelo. Vazio = todos, como antes desta migration.';

-- ---------------------------------------------------------------------------
-- Segunda logomarca
--
-- O timbre tinha uma única imagem, à esquerda. Prefeitura costuma imprimir
-- duas — o brasão do município de um lado e a marca do programa ou da
-- secretaria do outro (FUNDEB, PNAE, "Governo do Estado").
ALTER TABLE orgao_documento_config
  ADD COLUMN arquivo_logomarca_direita VARCHAR(255);
