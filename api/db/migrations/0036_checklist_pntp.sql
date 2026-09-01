-- 0036 — O que a planilha do cliente exigiu.
--
-- Chegou o "Relatório de Prevenção Mensal — PNTP e TCE": a conferência do
-- portal da transparência contra ~60 critérios oficiais, refeita todo mês. O
-- ciclo modelado na 0033 servia; o que faltava era o que organiza sessenta
-- linhas numa tela que alguém consiga percorrer.

-- ---------------------------------------------------------------------------
-- SEÇÃO, CÓDIGO e CLASSIFICAÇÃO

-- Campo de texto, e não tabela: serve a qualquer lista, e o custo conhecido —
-- "Receita" e "receitas" virando dois grupos — é menor que o de um cadastro a
-- mais para manter. Se divergir na prática, aí vale a tabela.
ALTER TABLE checklist_modelo_item ADD COLUMN secao VARCHAR(100);
ALTER TABLE checklist_item        ADD COLUMN secao VARCHAR(100);

-- O código oficial do critério: `2.2`, `8.5`, `18.1`. É por ele que a
-- controladoria conversa com o TCE, e **não** é a ordem do item — a lista pula
-- de 8.7 para 9.1, e o 11.1 aparece depois do 11.9.
ALTER TABLE checklist_modelo_item ADD COLUMN codigo VARCHAR(20);
ALTER TABLE checklist_item        ADD COLUMN codigo VARCHAR(20);

-- Peso, não etiqueta. "Faltam 3 obrigatórias e 1 essencial" é uma frase
-- diferente de "faltam 4": é o que decide onde a prefeitura corre primeiro,
-- porque é a obrigatória que o TCE cobra.
--
-- Nulo é permitido: item de checklist comum não tem classificação nenhuma, e
-- inventar uma para ele diria algo que ninguém afirmou.
ALTER TABLE checklist_modelo_item ADD COLUMN classificacao VARCHAR(12)
  CHECK (classificacao IS NULL
         OR classificacao IN ('OBRIGATORIA', 'ESSENCIAL', 'RECOMENDADA'));
ALTER TABLE checklist_item ADD COLUMN classificacao VARCHAR(12)
  CHECK (classificacao IS NULL
         OR classificacao IN ('OBRIGATORIA', 'ESSENCIAL', 'RECOMENDADA'));

-- ---------------------------------------------------------------------------
-- ANEXO DE REFERÊNCIA
--
-- A coluna "Modelo de Documento" da planilha diz "BAIXAR": o setor pega um
-- arquivo, preenche e devolve. É o modelo da planilha de fiscais, o formulário
-- de declaração — coisas que o motor de documentos não sabe gerar.
--
-- Um por item, e por isso colunas em vez de tabela. Ele acompanha a cópia:
-- aplicar o modelo leva o arquivo junto, sem duplicar o objeto no MinIO — o
-- caminho é o mesmo, e quem baixa lê, nunca escreve.

ALTER TABLE checklist_modelo_item
  ADD COLUMN modelo_arquivo       VARCHAR(255),
  ADD COLUMN modelo_nome_original VARCHAR(255);

ALTER TABLE checklist_item
  ADD COLUMN modelo_arquivo       VARCHAR(255),
  ADD COLUMN modelo_nome_original VARCHAR(255);

-- Arquivo e nome andam juntos: um sem o outro é um botão de download sem
-- rótulo, ou um rótulo que não baixa nada.
ALTER TABLE checklist_modelo_item ADD CONSTRAINT checklist_modelo_item_modelo
  CHECK ((modelo_arquivo IS NULL) = (modelo_nome_original IS NULL));
ALTER TABLE checklist_item ADD CONSTRAINT checklist_item_modelo
  CHECK ((modelo_arquivo IS NULL) = (modelo_nome_original IS NULL));

-- ---------------------------------------------------------------------------
-- SETORES DE APOIO
--
-- "CONTABILIDADE COM JURÍDICO" aparece em vários critérios. O item mantém **um
-- responsável** — quem responde por ele — e ganha uma lista de apoios: eles
-- veem o item na fila deles sem responder por ele.
--
-- A cobrança precisa de dono. "Dois responsáveis" vira "nenhum responsável" na
-- primeira vez que ninguém entrega.

CREATE TABLE checklist_modelo_item_apoio (
  modelo_item_id  UUID NOT NULL REFERENCES checklist_modelo_item(id) ON DELETE CASCADE,
  setor_id        UUID REFERENCES setor(id),
  departamento_id UUID REFERENCES departamento(id),

  -- Exatamente um destino, como na lotação: apoio que aponta para dois lugares
  -- não diz quem apoia.
  CONSTRAINT checklist_modelo_item_apoio_destino
    CHECK (num_nonnulls(setor_id, departamento_id) = 1)
);

-- O mesmo setor não apoia o item duas vezes.
CREATE UNIQUE INDEX idx_checklist_modelo_apoio_setor
  ON checklist_modelo_item_apoio(modelo_item_id, setor_id) WHERE setor_id IS NOT NULL;
CREATE UNIQUE INDEX idx_checklist_modelo_apoio_departamento
  ON checklist_modelo_item_apoio(modelo_item_id, departamento_id)
  WHERE departamento_id IS NOT NULL;

CREATE TABLE checklist_item_apoio (
  item_id         UUID NOT NULL REFERENCES checklist_item(id) ON DELETE CASCADE,
  setor_id        UUID REFERENCES setor(id),
  departamento_id UUID REFERENCES departamento(id),

  CONSTRAINT checklist_item_apoio_destino
    CHECK (num_nonnulls(setor_id, departamento_id) = 1)
);

CREATE UNIQUE INDEX idx_checklist_apoio_setor
  ON checklist_item_apoio(item_id, setor_id) WHERE setor_id IS NOT NULL;
CREATE UNIQUE INDEX idx_checklist_apoio_departamento
  ON checklist_item_apoio(item_id, departamento_id) WHERE departamento_id IS NOT NULL;

CREATE INDEX idx_checklist_apoio_item ON checklist_item_apoio(item_id);

-- A pergunta "o que está na minha fila?" passa a incluir o que o setor apoia.
CREATE INDEX idx_checklist_apoio_setor_busca
  ON checklist_item_apoio(setor_id) WHERE setor_id IS NOT NULL;

COMMENT ON COLUMN checklist_item.codigo IS
  'Código oficial do critério (PNTP: 2.2, 8.5). Não é a ordem do item.';
COMMENT ON TABLE checklist_item_apoio IS
  'Setores que apoiam o item sem responder por ele — o "COM JURÍDICO" da planilha.';

-- ---------------------------------------------------------------------------
-- O TÍTULO PRECISA CABER O CRITÉRIO
--
-- 200 caracteres foram escolhidos pensando em "Certidão negativa de débitos".
-- Os critérios do PNTP são perguntas inteiras — "Divulga informações sobre os
-- demais atos dos concursos públicos e processos seletivos da instituição:
-- vagas efetivamente preenchidas, lista de aprovados com as classificações,
-- fila de espera/cadastro reserva e validade?" tem 254.
--
-- Cortá-los para caber perderia justamente a parte que diz o que conferir.

ALTER TABLE checklist_modelo_item ALTER COLUMN titulo TYPE VARCHAR(500);
ALTER TABLE checklist_item        ALTER COLUMN titulo TYPE VARCHAR(500);
