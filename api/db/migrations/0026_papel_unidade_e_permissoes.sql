-- 0026 — Papel da unidade escolar, e as exceções de permissão passando a valer.
--
-- Com cinco módulos no ar, os papéis viraram uma confusão: a nutricionista
-- enxergava a frota, e quem recebe material na escola só podia ser SERVIDOR —
-- papel que dava contratos, licitações e processos da prefeitura inteira a uma
-- diretora que precisa pedir arroz.
--
-- A causa estava numa lista chamada READ_ONLY, herdada por quase todo papel,
-- montada quando o produto era um sistema só. Ela morre no código; aqui entra
-- o que depende do banco.

ALTER TABLE usuario DROP CONSTRAINT usuario_papel_base_check;

ALTER TABLE usuario ADD CONSTRAINT usuario_papel_base_check
  CHECK (papel_base IN (
    'ADMIN', 'GESTOR', 'SERVIDOR', 'PROTOCOLO',
    'COMPRAS', 'CONTROLADORIA', 'NUTRICIONISTA', 'UNIDADE',
    'PATRIMONIO', 'FROTAS'
  ));

-- `usuario_permissao` existe desde a 0001 e nunca foi lida por linha nenhuma
-- de código — mais uma configuração sem efeito. Passa a valer como exceção
-- sobre o papel, e por isso ganha as travas que nunca teve.
--
-- Sem o formato, "estoque" ou "stock:manag" entrariam na tabela e ficariam
-- caladas: a permissão nunca casaria com nenhuma rota, e o administrador
-- concluiria que concedeu.
ALTER TABLE usuario_permissao
  ADD CONSTRAINT usuario_permissao_formato
  CHECK (permissao ~ '^[a-z]+:[a-z]+$');

-- Quem concedeu e quando. Exceção de acesso sem autor é exatamente o registro
-- que a controladoria vai pedir para ver.
ALTER TABLE usuario_permissao
  ADD COLUMN concedida_por_usuario_id UUID REFERENCES usuario(id),
  ADD COLUMN concedida_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN motivo TEXT;

CREATE INDEX idx_usuario_permissao_usuario ON usuario_permissao(usuario_id);
