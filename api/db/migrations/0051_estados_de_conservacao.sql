-- 0051 — Mais degraus na escala de conservação do bem.
--
-- Eram quatro estados: NOVO, BOM, DANIFICADO e EM_CONSERTO. Entre "bom" e
-- "danificado" não havia nada, e é justamente onde mora a maior parte do
-- acervo de uma prefeitura: a cadeira que ainda serve e está gasta, o
-- ventilador que funciona mas faz barulho. Quem inventariava escolhia "bom"
-- para não acusar dano, e o inventário saía dizendo que está tudo bom.
--
-- Entram três degraus da régua clássica: REGULAR, RUIM e PESSIMO.
--
--   NOVO  >  BOM  >  REGULAR  >  RUIM  >  PESSIMO
--
-- DANIFICADO e EM_CONSERTO **ficam**, e não são degraus dessa régua — são
-- outra coisa. Danificado é dano pontual (a tela trincada de um monitor que
-- por tudo o mais está novo); em conserto é onde o bem está agora, não como
-- ele está. Misturá-los na escala obrigaria a reescrever o estado de bens já
-- tombados, e reescrever inventário passado é a única coisa que um sistema de
-- patrimônio não pode fazer.
--
-- ---------------------------------------------------------------------------
-- OS QUATRO CHECKS ANDAM JUNTOS
--
-- O estado aparece em quatro colunas, e são quatro momentos diferentes da vida
-- do bem:
--
--   * `bem.estado_conservacao` — como ele está hoje;
--   * `inventario_item.estado_observado` — o que o conferente viu no dia;
--   * `termo_responsabilidade_item.estado_na_entrega` — como saiu da mão de
--     quem entregou;
--   * `termo_responsabilidade_item.estado_na_devolucao` — como voltou.
--
-- Ampliar só a primeira deixaria o inventário sem conseguir registrar
-- "regular" — e o inventário é justamente quem descobre que o bem saiu de bom.
-- Deixar as do termo para trás seria pior: o termo é o papel que protege quem
-- assinou, e a diferença entre o estado da entrega e o da devolução é a única
-- coisa que ele prova.
--
-- `VARCHAR(12)` já acomoda as três palavras novas (a maior, PESSIMO, tem 7
-- caracteres; EM_CONSERTO, que já existia, tem 11). A coluna não muda.

ALTER TABLE bem DROP CONSTRAINT IF EXISTS bem_estado_conservacao_check;
ALTER TABLE bem
  ADD CONSTRAINT bem_estado_conservacao_check
  CHECK (estado_conservacao IN (
    'NOVO', 'BOM', 'REGULAR', 'RUIM', 'PESSIMO',
    'DANIFICADO', 'EM_CONSERTO'
  ));

ALTER TABLE inventario_item DROP CONSTRAINT IF EXISTS inventario_item_estado_observado_check;
ALTER TABLE inventario_item
  ADD CONSTRAINT inventario_item_estado_observado_check
  CHECK (estado_observado IN (
    'NOVO', 'BOM', 'REGULAR', 'RUIM', 'PESSIMO',
    'DANIFICADO', 'EM_CONSERTO'
  ));

ALTER TABLE termo_responsabilidade_item
  DROP CONSTRAINT IF EXISTS termo_responsabilidade_item_estado_na_entrega_check;
ALTER TABLE termo_responsabilidade_item
  ADD CONSTRAINT termo_responsabilidade_item_estado_na_entrega_check
  CHECK (estado_na_entrega IN (
    'NOVO', 'BOM', 'REGULAR', 'RUIM', 'PESSIMO',
    'DANIFICADO', 'EM_CONSERTO'
  ));

ALTER TABLE termo_responsabilidade_item
  DROP CONSTRAINT IF EXISTS termo_responsabilidade_item_estado_na_devolucao_check;
ALTER TABLE termo_responsabilidade_item
  ADD CONSTRAINT termo_responsabilidade_item_estado_na_devolucao_check
  CHECK (estado_na_devolucao IS NULL
         OR estado_na_devolucao IN (
           'NOVO', 'BOM', 'REGULAR', 'RUIM', 'PESSIMO',
           'DANIFICADO', 'EM_CONSERTO'
         ));

COMMENT ON COLUMN bem.estado_conservacao IS
  'Escala NOVO > BOM > REGULAR > RUIM > PESSIMO, mais DANIFICADO (dano pontual) e EM_CONSERTO (onde o bem está, não como está).';