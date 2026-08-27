-- 0025 — O documento passa a nascer em rascunho, para poder ser revisado.
--
-- Pedido do cliente: ajustar texto e datas antes de a peça sair. A emissão era
-- um ato só — clicar em "Emitir" gravava a peça com código verificador e a
-- publicava em /conferencia/{codigo}. Editar depois disso faria a conferência
-- mentir: o TCE abriria o código e veria algo diferente do papel assinado.
--
-- Por isso a edição fica ANTES. A peça é montada, ganha o código (que o próprio
-- corpo imprime), e espera em rascunho até alguém confirmar. Enquanto está em
-- rascunho não é conferível, não aparece nas listagens e pode ser descartada.

ALTER TABLE documento_emitido
  ADD COLUMN situacao VARCHAR(10) NOT NULL DEFAULT 'EMITIDO'
    CHECK (situacao IN ('RASCUNHO', 'EMITIDO')),
  -- Guarda o texto como o modelo o produziu. Sem isto não há como mostrar o
  -- que mudou, nem provar que nada mudou: o corpo editado sobrescreve o
  -- original e a diferença se perde.
  ADD COLUMN corpo_original TEXT,
  ADD COLUMN editado_em TIMESTAMPTZ,
  ADD COLUMN editado_por_usuario_id UUID REFERENCES usuario(id),
  -- `data` é o instante da emissão; o rascunho ainda não tem uma. Esta é a de
  -- criação, que a tela usa para listar os rascunhos pendentes.
  ADD COLUMN criado_em TIMESTAMPTZ NOT NULL DEFAULT now();

-- Linha antiga é documento emitido de verdade: o default já cuidou disso.
-- Daqui para frente a situação é sempre escrita pelo caso de uso.
ALTER TABLE documento_emitido ALTER COLUMN situacao DROP DEFAULT;

-- Rascunho não tem data de emissão. Deixá-la preenchida por conveniência faria
-- a peça alegar ter saído num dia em que ainda estava sendo escrita.
ALTER TABLE documento_emitido ALTER COLUMN data DROP NOT NULL;

ALTER TABLE documento_emitido
  ADD CONSTRAINT documento_emitido_data_da_situacao
  CHECK (
    (situacao = 'RASCUNHO' AND data IS NULL)
    OR (situacao = 'EMITIDO' AND data IS NOT NULL)
  );

-- Cancelar um rascunho não faz sentido: rascunho se descarta, e o que se
-- cancela é a peça que já circulou.
ALTER TABLE documento_emitido
  ADD CONSTRAINT documento_emitido_cancelamento_so_do_emitido
  CHECK (cancelado_em IS NULL OR situacao = 'EMITIDO');

-- Editado sem quando/quem seria alteração anônima em documento oficial.
ALTER TABLE documento_emitido
  ADD CONSTRAINT documento_emitido_edicao_tem_autor
  CHECK (num_nonnulls(editado_em, editado_por_usuario_id) IN (0, 2));

-- A fila de rascunhos é por autor: cada um revisa o que preparou.
CREATE INDEX idx_documento_emitido_rascunho
  ON documento_emitido (orgao_id, emitido_por_usuario_id)
  WHERE situacao = 'RASCUNHO';
