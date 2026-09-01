-- 0040 — As modalidades de contratação da Lei 14.133 e do layout do Tribunal.
--
-- O CHECK tinha oito valores e faltava quase tudo o que uma prefeitura usa:
-- dispensa eletrônica, credenciamento, adesão a ata, tomada de preços, carta
-- convite, RDC. Quem precisava cadastrar uma dessas escolhia a mais parecida —
-- e o dado ficava errado justamente no campo que a prestação de contas lê.
--
-- Os oito antigos continuam válidos, com o mesmo identificador: há licitação
-- gravada com cada um deles, e renomear seria reescrever histórico.
-- `CHAMADA_PUBLICA` não está na lista do Tribunal, mas é a modalidade da
-- agricultura familiar do PNAE — apagá-la deixaria registros apontando para um
-- valor inexistente.
--
-- A sigla de duas letras (DP, PE, AA…) mora no código, em
-- `domain/licitacao/Modalidades.ts`. Ela é da camada de exportação, não do
-- armazenamento: no banco fica o identificador legível, que num `SELECT` diz o
-- que é sem consulta a tabela nenhuma.

ALTER TABLE licitacao DROP CONSTRAINT licitacao_modalidade_check;

ALTER TABLE licitacao ADD CONSTRAINT licitacao_modalidade_check
  CHECK (modalidade IN (
    'DISPENSA',                 -- DP
    'DISPENSA_ELETRONICA',      -- DE
    'INEXIGIBILIDADE',          -- IN
    'CREDENCIAMENTO',           -- CR
    'ADESAO_ATA',               -- AA
    'CONCORRENCIA',             -- CP
    'TOMADA_DE_PRECOS',         -- TP
    'CARTA_CONVITE',            -- CC
    'CONCURSO',                 -- CO
    'LEILAO',                   -- LL
    'LICITACAO_INTERNACIONAL',  -- LI
    'PREGAO_ELETRONICO',        -- PE
    'PREGAO_PRESENCIAL',        -- PP
    'RDC_ELETRONICO',           -- RE
    'RDC_PRESENCIAL',           -- RP
    'DIALOGO_COMPETITIVO',      -- DC
    'LEI_13303',                -- PL
    'OUTROS',                   -- OT
    'CHAMADA_PUBLICA'           -- sem sigla no layout; exporta como OT
  ));
