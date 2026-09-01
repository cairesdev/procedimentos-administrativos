-- 0035 — O link externo do checklist.
--
-- A segunda fatia: o fornecedor cumpre exigências sem ter conta no sistema.
-- Mesmo desenho do convite de fornecedor (0029), que já está em produção —
-- token sorteado, só o hash no banco, prazo, revogável.
--
-- É outro convite, e não o mesmo: aquele dá acesso ao cadastro do fornecedor,
-- este a um checklist. Reaproveitar a tabela faria um token de cadastro abrir
-- uma lista de exigências, e o alvo de um segredo é parte do segredo.

CREATE TABLE checklist_convite (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id  UUID NOT NULL REFERENCES checklist(id) ON DELETE CASCADE,

  -- O token é o segredo. Guarda-se o hash, não ele: quem lê o banco não abre
  -- a página de ninguém, e é a mesma regra que já vale para senha.
  token_hash    CHAR(64) NOT NULL UNIQUE,

  -- Para quem foi enviado. Texto livre porque nem todo destinatário é um
  -- fornecedor cadastrado — pode ser um engenheiro, um cartório, um consórcio.
  destinatario  VARCHAR(200),

  criado_por    UUID REFERENCES usuario(id),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Link sem prazo é chave permanente entregue por e-mail. O prazo é decidido
  -- na criação e não se estende: para dar mais tempo, gera-se outro.
  expira_em     TIMESTAMPTZ NOT NULL,

  -- Não morre no primeiro uso: o fornecedor volta para entregar o que faltou,
  -- e para corrigir o que foi recusado. `usado_em` guarda a última visita.
  usado_em      TIMESTAMPTZ,
  revogado_em   TIMESTAMPTZ,

  CHECK (expira_em > criado_em)
);

-- Um convite aberto por checklist. Sem isto, cada clique no botão geraria mais
-- um link válido, e revogar um não fecharia os outros.
CREATE UNIQUE INDEX idx_checklist_convite_aberto
  ON checklist_convite(checklist_id)
  WHERE revogado_em IS NULL;

CREATE INDEX idx_checklist_convite_checklist
  ON checklist_convite(checklist_id, criado_em DESC);

COMMENT ON TABLE checklist_convite IS
  'Acesso sem login para cumprir os itens do checklist destinados ao fornecedor.';
