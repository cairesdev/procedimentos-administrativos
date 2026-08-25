-- Escopo do modelo de documento.
--
-- Até aqui o `tipo` decidia tudo: quais marcadores existem e de onde os dados
-- vêm. Isso travava o catálogo no código e impedia a prefeitura de criar peça
-- nova. O `escopo` separa as duas coisas: ele diz de onde o documento fala
-- (processo, contrato, ordem, solicitação) e o `tipo` volta a ser só a
-- identidade da peça — inclusive uma inventada pelo administrador.

ALTER TABLE documento_modelo
  ADD COLUMN escopo VARCHAR(30) NOT NULL DEFAULT 'PROCESSO'
    CHECK (escopo IN ('PROCESSO', 'PROCESSO_CONTRATO', 'ORDEM_FORNECIMENTO', 'SOLICITACAO'));

-- Os sete modelos semeados em 0015 recebem o escopo que já usavam de fato.
UPDATE documento_modelo SET escopo = 'PROCESSO_CONTRATO'
 WHERE tipo IN ('DESPACHO_FISCAL', 'RELATORIO_CONTROLADORIA');
UPDATE documento_modelo SET escopo = 'ORDEM_FORNECIMENTO'
 WHERE tipo = 'ORDEM_FORNECIMENTO';
UPDATE documento_modelo SET escopo = 'SOLICITACAO'
 WHERE tipo = 'COMPROVANTE_SOLICITACAO';

-- O default some: modelo novo declara o escopo, não herda um por descuido.
ALTER TABLE documento_modelo ALTER COLUMN escopo DROP DEFAULT;

-- Peça criada pela prefeitura não é padrão do produto. A coluna distingue as
-- duas para a tela não oferecer "restaurar padrão" onde não há padrão nenhum.
ALTER TABLE documento_modelo
  ADD COLUMN personalizado BOOLEAN NOT NULL DEFAULT FALSE;

-- `tipo` deixa de ser vocabulário fechado: passa a aceitar o identificador que
-- o administrador escolher. O formato é limitado para caber na URL e no índice.
ALTER TABLE documento_modelo
  ADD CONSTRAINT documento_modelo_tipo_formato
  CHECK (tipo ~ '^[A-Z][A-Z0-9_]{2,39}$');
