-- 0023 — Almoxarifado, 2ª fatia: consumo, devolução, transferência e ajuste.
--
-- As quatro tabelas nasceram em 0005 pensando em saldo agregado por produto.
-- Desde a 0021 o estoque da unidade é LOTE, com validade própria — e todo
-- movimento precisa dizer de qual lote saiu. Sem isso a escola consumiria
-- "arroz" sem que o sistema soubesse qual caixa foi aberta, e o FEFO viraria
-- enfeite.

-- ---------------------------------------------------------------------------
-- Consumo
--
-- Duas formas, como o levantamento decidiu: item a item (a escola registra
-- cada retirada) e declaração periódica (no fim do mês, quanto foi usado).
-- A segunda existe porque nenhuma cozinha de escola vai lançar cada quilo de
-- arroz no sistema — e uma declaração aproximada é melhor que nenhum registro.

ALTER TABLE consumo
  ADD COLUMN usuario_id   UUID REFERENCES usuario(id),
  ADD COLUMN observacao   TEXT,
  ADD COLUMN created_at   TIMESTAMPTZ NOT NULL DEFAULT now();

-- Período só faz sentido na declaração; item a item tem a data do ato.
ALTER TABLE consumo ADD CONSTRAINT consumo_periodo_check
  CHECK (
    (forma = 'DECLARACAO_PERIODICA' AND periodo_inicio IS NOT NULL AND periodo_fim IS NOT NULL)
    OR (forma = 'ITEM_A_ITEM' AND periodo_inicio IS NULL AND periodo_fim IS NULL)
  );

ALTER TABLE consumo ADD CONSTRAINT consumo_periodo_ordem_check
  CHECK (periodo_fim IS NULL OR periodo_fim >= periodo_inicio);

ALTER TABLE consumo ADD CONSTRAINT consumo_quantidade_check
  CHECK (quantidade > 0);

-- De qual lote da unidade saiu quanto. Mesma estrutura de `liberacao_lote`:
-- o consumo de 10 kg pode vir de duas caixas com validades diferentes, e o
-- relatório do PNAE precisa saber de quais.
CREATE TABLE consumo_lote (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumo_id        UUID NOT NULL REFERENCES consumo(id) ON DELETE CASCADE,
  estoque_local_id  UUID NOT NULL REFERENCES estoque_local(id),
  quantidade        NUMERIC(14,3) NOT NULL CHECK (quantidade > 0)
);
CREATE INDEX idx_consumo_lote_consumo ON consumo_lote(consumo_id);
CREATE INDEX idx_consumo_lote_estoque ON consumo_lote(estoque_local_id);

CREATE INDEX idx_consumo_produto ON consumo(local_id, produto_id, data);

-- ---------------------------------------------------------------------------
-- Devolução
--
-- A unidade devolve o que não vai usar, e o material só volta ao saldo do
-- almoxarifado **depois do aceite** — quem recebe confere antes de assumir.
-- Devolver sem conferência deixaria o almoxarifado com saldo de algo que
-- talvez nem tenha chegado de volta.

ALTER TABLE devolucao
  -- Qual lote da unidade está voltando: é ele que carrega a validade, e é o
  -- saldo dele que baixa. Sem isto a devolução seria de "arroz", e o
  -- almoxarifado não saberia qual caixa recebeu de volta.
  ADD COLUMN estoque_local_id          UUID REFERENCES estoque_local(id),
  ADD COLUMN motivo                    TEXT,
  ADD COLUMN solicitada_por_usuario_id UUID REFERENCES usuario(id),
  ADD COLUMN recusa_motivo             TEXT,
  ADD COLUMN respondida_em             TIMESTAMPTZ;

ALTER TABLE devolucao ADD CONSTRAINT devolucao_quantidade_check
  CHECK (quantidade > 0);

-- Resposta e data andam juntas: uma sem a outra é estado impossível.
ALTER TABLE devolucao ADD CONSTRAINT devolucao_resposta_check
  CHECK ((status = 'PENDENTE') = (respondida_em IS NULL));

-- Recusa sem motivo deixa a unidade sem saber o que fazer com o material.
ALTER TABLE devolucao ADD CONSTRAINT devolucao_recusa_check
  CHECK (status <> 'RECUSADA' OR recusa_motivo IS NOT NULL);

CREATE INDEX idx_devolucao_pendentes ON devolucao(almoxarifado_id, data)
  WHERE status = 'PENDENTE';

-- ---------------------------------------------------------------------------
-- Transferência entre almoxarifados
--
-- O lote pertence a uma remessa, que pertence a um almoxarifado. Transferir
-- não muda o dono do lote: **cria uma remessa de transferência no destino**,
-- com lotes novos que preservam a validade e apontam para a origem.
--
-- Assim o destino enxerga a chegada como qualquer outra entrada — mesma tela,
-- mesmo FEFO, mesmo comprovante — e o rastro de onde veio fica no lote.

ALTER TABLE remessa_estoque
  ADD COLUMN transferencia_id UUID REFERENCES transferencia_almoxarifado(id);

CREATE INDEX idx_remessa_transferencia ON remessa_estoque(transferencia_id)
  WHERE transferencia_id IS NOT NULL;

ALTER TABLE lote
  ADD COLUMN lote_origem_id UUID REFERENCES lote(id);

ALTER TABLE transferencia_almoxarifado
  ADD COLUMN motivo     TEXT,
  ADD COLUMN observacao TEXT;

ALTER TABLE transferencia_almoxarifado ADD CONSTRAINT transferencia_almox_quantidade_check
  CHECK (quantidade > 0);

-- Transferir para o próprio almoxarifado não move nada e sujaria o histórico.
ALTER TABLE transferencia_almoxarifado ADD CONSTRAINT transferencia_almox_destino_check
  CHECK (almoxarifado_origem_id <> almoxarifado_destino_id);

CREATE INDEX idx_transferencia_almox_origem
  ON transferencia_almoxarifado(almoxarifado_origem_id, data);

-- ---------------------------------------------------------------------------
-- Ajuste de estoque
--
-- Contagem física que não bate. Vale nos dois lados: o almoxarifado ajusta o
-- lote dele, a escola ajusta o que tem no armário. Antes só o almoxarifado
-- podia — e a escola ficava com saldo errado sem caminho de correção.

ALTER TABLE ajuste_estoque
  ALTER COLUMN almoxarifado_id DROP NOT NULL,
  ALTER COLUMN lote_id DROP NOT NULL;

ALTER TABLE ajuste_estoque
  ADD COLUMN estoque_local_id UUID REFERENCES estoque_local(id),
  ADD COLUMN observacao       TEXT;

-- Um lado ou o outro, nunca os dois: um ajuste que aponta para lote do
-- almoxarifado E para estoque da escola não teria saldo definido.
ALTER TABLE ajuste_estoque ADD CONSTRAINT ajuste_estoque_alvo_check
  CHECK ((lote_id IS NULL) <> (estoque_local_id IS NULL));

-- Ajuste do almoxarifado precisa dizer de qual almoxarifado é.
ALTER TABLE ajuste_estoque ADD CONSTRAINT ajuste_estoque_almoxarifado_check
  CHECK ((lote_id IS NULL) = (almoxarifado_id IS NULL));

ALTER TABLE ajuste_estoque ADD CONSTRAINT ajuste_estoque_saldo_check
  CHECK (saldo_anterior >= 0 AND saldo_corrigido >= 0);

-- Ajuste que não muda nada é ruído no histórico.
ALTER TABLE ajuste_estoque ADD CONSTRAINT ajuste_estoque_diferenca_check
  CHECK (saldo_corrigido <> saldo_anterior);

-- O CHECK original só previa perda. Contagem física acha material a mais
-- também — caixa que estava atrás da porta, entrada lançada a menor.
ALTER TABLE ajuste_estoque DROP CONSTRAINT ajuste_estoque_motivo_check;
ALTER TABLE ajuste_estoque ADD CONSTRAINT ajuste_estoque_motivo_check
  CHECK (motivo IN (
    'PERDA', 'AVARIA', 'VENCIDO', 'ERRO_LANCAMENTO', 'SOBRA', 'CONTAGEM'
  ));

CREATE INDEX idx_ajuste_estoque_local ON ajuste_estoque(estoque_local_id)
  WHERE estoque_local_id IS NOT NULL;
