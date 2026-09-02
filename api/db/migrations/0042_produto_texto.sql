-- 0042 — O produto do item deixa de ter teto de caracteres.
--
-- `VARCHAR(150)` era um palpite, e o palpite era baixo. A especificação de um
-- item de licitação não é um nome curto: vem com marca, gramatura, embalagem,
-- norma técnica e faixa de tolerância, tudo na mesma linha da planilha, porque
-- é assim que o edital descreve o que está sendo comprado. Passar de 150 é
-- comum, e quando passava a importação recusava a linha ou o servidor abreviava
-- à mão — e aí o que está no sistema deixa de ser o que está no edital.
--
-- **TEXT, e não VARCHAR(600).** No Postgres os dois têm exatamente o mesmo
-- armazenamento e o mesmo desempenho; `VARCHAR(n)` só acrescenta uma checagem
-- de comprimento. Um teto de 600 seria outro palpite, atingido no dia em que
-- alguém colar a especificação completa de um equipamento — e mudá-lo pediria
-- mais uma migration. O limite que faz sentido é o da camada que recebe dado de
-- fora: a validação da API recusa acima de 2000, que é generoso para uma
-- descrição e apertado para um abuso.
--
-- Vale para o item do contrato e para o da ata: são o mesmo campo, preenchidos
-- pelo mesmo editor, e deixar um dos dois curto criaria o caso "colei na ata e
-- funcionou, colei no contrato e cortou".
--
-- Nenhum dado se perde: alargar o tipo não toca nas linhas existentes, e o
-- Postgres faz isso sem reescrever a tabela.

ALTER TABLE item     ALTER COLUMN produto TYPE TEXT;
ALTER TABLE ata_item ALTER COLUMN produto TYPE TEXT;
