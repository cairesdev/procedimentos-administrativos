-- 0029 — Link externo do fornecedor.
--
-- `fornecedor_historico.alterado_por` aceita `link_externo` desde a 0001, e o
-- caminho que produziria esse valor nunca existiu: era uma decisão do
-- levantamento viva só como comentário numa coluna.
--
-- O fornecedor recebe um endereço, abre sem login e corrige o próprio cadastro.
-- Quem digita razão social e endereço errado hoje é o setor de compras, a
-- partir de um papel; ninguém conhece o dado melhor que o dono dele.

CREATE TABLE fornecedor_convite (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id  UUID NOT NULL REFERENCES fornecedor(id),

  -- O token é o segredo. Guarda-se o **hash**, não ele: quem lê o banco não
  -- pode abrir a página de ninguém, e é a mesma regra que já vale para senha.
  token_hash     CHAR(64) NOT NULL UNIQUE,

  -- Quem convidou. O fornecedor é global e o convite é de uma prefeitura:
  -- sem isto não haveria como saber quem abriu a porta.
  orgao_id       UUID NOT NULL REFERENCES orgao(id),
  criado_por     UUID REFERENCES usuario(id),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Link sem prazo é chave permanente entregue por e-mail. O prazo é decidido
  -- na criação e não se estende: para dar mais tempo, gera-se outro.
  expira_em      TIMESTAMPTZ NOT NULL,

  -- O convite continua valendo até expirar, e não morre no primeiro uso: o
  -- fornecedor volta para corrigir o que digitou errado. `usado_em` guarda a
  -- última vez, que é o que interessa a quem acompanha.
  usado_em       TIMESTAMPTZ,
  revogado_em    TIMESTAMPTZ,

  CHECK (expira_em > criado_em)
);

CREATE INDEX idx_fornecedor_convite_fornecedor
  ON fornecedor_convite(fornecedor_id, criado_em DESC);

-- Um convite aberto por fornecedor e prefeitura. Sem isto, cada clique no
-- botão geraria mais um link válido, e revogar um não fecharia os outros.
CREATE UNIQUE INDEX idx_fornecedor_convite_aberto
  ON fornecedor_convite(fornecedor_id, orgao_id)
  WHERE revogado_em IS NULL;

COMMENT ON TABLE fornecedor_convite IS
  'Acesso sem login para o fornecedor corrigir o próprio cadastro global.';
