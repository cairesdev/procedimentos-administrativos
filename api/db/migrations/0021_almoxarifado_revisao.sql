-- 0021 — Almoxarifado: o que a leitura do sistema legado mudou.
--
-- O schema de 0005 nasceu do levantamento; este ajusta os pontos que a leitura
-- do legado (docs/legado-almoxarifado.md) corrigiu ou completou. Nada aqui é
-- feature nova: é o mesmo módulo, com o modelo que o uso real exige.

-- ---------------------------------------------------------------------------
-- LOCAL ganha identidade própria
--
-- Escola e posto de saúde não são só "um lugar com código": têm CNPJ próprio
-- (exigido na prestação de contas do PNAE), endereço para onde a entrega vai e
-- alguém a quem ligar quando a carga chega. O local segue compartilhado com o
-- patrimônio — o mesmo prédio guarda bem tombado e estoque.

ALTER TABLE local
  ADD COLUMN cnpj        VARCHAR(14),
  ADD COLUMN endereco    VARCHAR(200),
  ADD COLUMN bairro      VARCHAR(100),
  ADD COLUMN municipio   VARCHAR(100),
  ADD COLUMN uf          CHAR(2),
  ADD COLUMN cep         VARCHAR(8),
  ADD COLUMN telefone    VARCHAR(20),
  ADD COLUMN email       VARCHAR(150),
  ADD COLUMN responsavel VARCHAR(150);

-- Sem UNIQUE no CNPJ de propósito: município pequeno costuma cadastrar todas
-- as escolas sob o CNPJ da própria prefeitura, e a restrição impediria o
-- cadastro da segunda escola. O índice serve à busca, não à unicidade.
CREATE INDEX idx_local_cnpj ON local(cnpj) WHERE cnpj IS NOT NULL;

-- ---------------------------------------------------------------------------
-- PRODUTO vira catálogo global
--
-- "CORANTE NATURAL / KG" é o mesmo item em qualquer município. Com `orgao_id`,
-- cada prefeitura recadastraria os mesmos 300 produtos e o relatório
-- consolidado do produto ficaria impossível. Mesma escolha já feita para
-- `fornecedor`, e a mesma que o legado fazia com UNIQUE (nome, und_medida).

ALTER TABLE produto DROP CONSTRAINT produto_orgao_id_nome_unidade_medida_key;
ALTER TABLE produto DROP COLUMN orgao_id;
ALTER TABLE produto ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE produto ADD CONSTRAINT produto_nome_unidade_key UNIQUE (nome, unidade_medida);

-- ---------------------------------------------------------------------------
-- O LOTE sobrevive à entrega
--
-- `estoque_local` guardava saldo agregado por produto e perdia a validade no
-- momento da entrega — justo o dado que a escola precisa para consumir o que
-- vence primeiro. Passa a ser lote: cada entrega cria uma linha, com a validade
-- copiada da origem e o rastro de onde veio.

ALTER TABLE estoque_local DROP CONSTRAINT estoque_local_local_id_produto_id_key;

ALTER TABLE estoque_local
  ADD COLUMN lote_origem_id       UUID REFERENCES lote(id),
  ADD COLUMN liberacao_lote_id    UUID REFERENCES liberacao_lote(id),
  ADD COLUMN quantidade_recebida  NUMERIC(14,3),
  ADD COLUMN data_validade        DATE,
  ADD COLUMN data_entrada         DATE NOT NULL DEFAULT current_date;

ALTER TABLE estoque_local ADD CONSTRAINT estoque_local_saldo_check
  CHECK (saldo >= 0 AND (quantidade_recebida IS NULL OR saldo <= quantidade_recebida));

-- FEFO na unidade: a consulta que monta a baixa por consumo ordena por
-- validade, e sem este índice varreria o estoque inteiro da escola.
CREATE INDEX idx_estoque_local_fefo
  ON estoque_local(local_id, produto_id, data_validade NULLS LAST)
  WHERE saldo > 0;

-- Uma entrega gera uma linha de estoque na unidade. Sem isto, reprocessar a
-- confirmação de recebimento duplicaria o saldo da escola.
CREATE UNIQUE INDEX idx_estoque_local_por_liberacao
  ON estoque_local(liberacao_lote_id) WHERE liberacao_lote_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Recebimento a menor vira perda
--
-- A diferença entre o que saiu do almoxarifado e o que a escola confirmou não
-- volta ao estoque: sai como quebra, com motivo. Fica na própria liberação
-- porque a perda nasce daquela entrega — em tabela à parte, fechar a conta de
-- uma liberação exigiria juntar duas.

ALTER TABLE liberacao_lote
  ADD COLUMN quantidade_confirmada NUMERIC(14,3),
  ADD COLUMN quantidade_perdida    NUMERIC(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN motivo_perda          VARCHAR(20)
                                     CHECK (motivo_perda IN ('QUEBRA_TRANSPORTE', 'AVARIA',
                                                             'VENCIDO', 'EXTRAVIO', 'OUTRO')),
  ADD COLUMN observacao_perda      TEXT,
  ADD COLUMN confirmada_em         TIMESTAMPTZ;

-- Perda sem motivo é diferença não explicada virando número no relatório.
ALTER TABLE liberacao_lote ADD CONSTRAINT liberacao_lote_perda_check
  CHECK (quantidade_perdida = 0 OR motivo_perda IS NOT NULL);

-- O que a escola confirmou mais o que se perdeu tem de fechar com o que saiu.
ALTER TABLE liberacao_lote ADD CONSTRAINT liberacao_lote_fecha_check
  CHECK (
    quantidade_confirmada IS NULL
    OR quantidade_confirmada + quantidade_perdida = quantidade
  );

-- ---------------------------------------------------------------------------
-- A reserva nasce no envio
--
-- No legado a reserva vivia no Redis, era criada a cada item adicionado ao
-- rascunho e **nunca era baixada na liberação**: o material ficava reservado e
-- debitado ao mesmo tempo por até 48 horas. Aqui ela é coluna, entra na mesma
-- transação do envio e sai na mesma transação da liberação.

ALTER TABLE solicitacao_estoque
  ADD COLUMN enviada_em             TIMESTAMPTZ,
  ADD COLUMN liberada_por_usuario_id UUID REFERENCES usuario(id),
  ADD COLUMN liberada_em            TIMESTAMPTZ,
  ADD COLUMN recebida_por_usuario_id UUID REFERENCES usuario(id),
  ADD COLUMN recebida_em            TIMESTAMPTZ,
  ADD COLUMN motivo_recusa          TEXT;

-- RASCUNHO passa a existir: é o estado em que o pedido está sendo montado e
-- **não** segura saldo nenhum.
ALTER TABLE solicitacao_estoque DROP CONSTRAINT solicitacao_estoque_status_check;
ALTER TABLE solicitacao_estoque ADD CONSTRAINT solicitacao_estoque_status_check
  CHECK (status IN ('RASCUNHO', 'SOLICITADA', 'LIBERADA', 'EM_TRANSITO',
                    'RECEBIDA', 'RECUSADA', 'CANCELADA', 'EXPIRADA'));

ALTER TABLE solicitacao_estoque ALTER COLUMN status SET DEFAULT 'RASCUNHO';

-- Rascunho não tem data de envio; enviada, tem. Estado impossível barrado no
-- banco, e não só no caso de uso.
ALTER TABLE solicitacao_estoque ADD CONSTRAINT solicitacao_estoque_envio_check
  CHECK ((status = 'RASCUNHO') = (enviada_em IS NULL));

-- A reserva por item: quanto do saldo do produto está preso por esta linha.
-- Zera na liberação, no cancelamento e na expiração.
ALTER TABLE solicitacao_estoque_item
  ADD COLUMN quantidade_reservada NUMERIC(14,3) NOT NULL DEFAULT 0
    CHECK (quantidade_reservada >= 0);

-- Fila do almoxarife: as abertas, por data. Sem o índice parcial, a varredura
-- passaria por todo o histórico de solicitações já encerradas.
CREATE INDEX idx_solicitacao_estoque_abertas
  ON solicitacao_estoque(status, data)
  WHERE status IN ('SOLICITADA', 'LIBERADA', 'EM_TRANSITO');

-- Reserva a expirar: quem roda a limpeza precisa achar as vencidas sem ler
-- a tabela inteira.
CREATE INDEX idx_solicitacao_estoque_reserva
  ON solicitacao_estoque(reserva_expira_em)
  WHERE reserva_expira_em IS NOT NULL AND status = 'SOLICITADA';

-- ---------------------------------------------------------------------------
-- Configuração do módulo, por prefeitura
--
-- A expiração da reserva é a única regra que muda de prefeitura para
-- prefeitura: onde o almoxarife libera no mesmo dia, prazo curto evita pedido
-- fantasma; onde a liberação demora uma semana, prazo curto derrubaria pedido
-- legítimo. Por isso é configuração, não constante.

CREATE TABLE almoxarifado_config (
  orgao_id            UUID PRIMARY KEY REFERENCES orgao(id),
  reserva_ativa       BOOLEAN NOT NULL DEFAULT TRUE,
  reserva_prazo_horas INTEGER NOT NULL DEFAULT 72
                        CHECK (reserva_prazo_horas > 0),
  -- Dias de antecedência para a tela sinalizar lote perto do vencimento.
  -- Só alerta: validade nunca bloqueia liberação nem consumo.
  alerta_validade_dias INTEGER NOT NULL DEFAULT 30
                        CHECK (alerta_validade_dias > 0)
);

-- ---------------------------------------------------------------------------
-- Remessa com responsável
--
-- Quem registrou a entrada responde por ela. O legado guardava isso e é o que
-- permite voltar à pessoa quando a contagem não fecha.

ALTER TABLE remessa_estoque
  ADD COLUMN responsavel_usuario_id UUID REFERENCES usuario(id),
  ADD COLUMN nota_fiscal            VARCHAR(40),
  ADD COLUMN fornecedor_id          UUID REFERENCES fornecedor(id),
  ADD COLUMN created_at             TIMESTAMPTZ NOT NULL DEFAULT now();

-- Lote sem saldo não entra em FEFO nem em listagem de disponíveis.
CREATE INDEX idx_lote_fefo
  ON lote(produto_id, data_validade NULLS LAST)
  WHERE saldo > 0;
