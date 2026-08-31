-- 0030 — Registro de qualidade do lote.
--
-- Existe no legado (`qualidade_produto_estocado`) e foi adiado no levantamento
-- do almoxarifado, porque o ajuste de estoque com motivo cobria o caso urgente.
-- O que faltava é o acompanhamento: a caixa que chegou amassada, o lote que
-- vence semana que vem, a câmara fria que oscilou.
--
-- **Não mexe em saldo.** Quem tira material do estoque é o ajuste, que já
-- existe e exige motivo. Este registro anota o que se observou — e é
-- justamente por não movimentar nada que ele pode ser opcional e livre.

CREATE TABLE qualidade_lote (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Um lado ou o outro, nunca os dois: o lote está no almoxarifado, o
  -- `estoque_local` é o que já foi para o armário da escola. Mesma regra do
  -- ajuste, e pelo mesmo motivo — a observação é sobre material que está em
  -- um lugar só.
  lote_id           UUID REFERENCES lote(id),
  estoque_local_id  UUID REFERENCES estoque_local(id),

  tipo              VARCHAR(20) NOT NULL
                      CHECK (tipo IN ('DANO', 'VALIDADE', 'ARMAZENAMENTO',
                                      'CONFORMIDADE', 'OUTRO')),
  observacao        TEXT NOT NULL,

  -- Quantidade afetada é opcional: "duas caixas amassadas" é uma informação,
  -- "a câmara fria oscilou" é outra, e as duas cabem aqui.
  quantidade        NUMERIC(14,3) CHECK (quantidade IS NULL OR quantidade > 0),

  usuario_id        UUID NOT NULL REFERENCES usuario(id),
  data              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (num_nonnulls(lote_id, estoque_local_id) = 1),
  -- Registro sem texto seria uma linha dizendo que algo aconteceu, sem dizer o
  -- quê. O tipo sozinho não conta a história.
  CHECK (length(btrim(observacao)) >= 3)
);

CREATE INDEX idx_qualidade_lote_lote ON qualidade_lote(lote_id) WHERE lote_id IS NOT NULL;
CREATE INDEX idx_qualidade_lote_estoque
  ON qualidade_lote(estoque_local_id) WHERE estoque_local_id IS NOT NULL;
CREATE INDEX idx_qualidade_lote_data ON qualidade_lote(data DESC);

COMMENT ON TABLE qualidade_lote IS
  'Acompanhamento do material armazenado: dano, validade, armazenagem. Não altera saldo.';
