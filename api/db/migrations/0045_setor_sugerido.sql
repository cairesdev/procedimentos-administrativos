-- 0045 — A sugestão de responsável sai do texto e vira campo.
--
-- A 0037 deixou registrado por quê o modelo global do PNTP não traz setor:
-- "CONTABILIDADE COM JURÍDICO" são nomes de uma prefeitura, e o modelo é de
-- todas. A decisão está certa; o efeito colateral não: a sugestão do Tribunal
-- ficou dentro da descrição, em prosa, e aplicar o modelo virou 53 atribuições
-- à mão — em uma lista refeita todo mês.
--
-- Enterrada no texto, a sugestão só serve para quem lê item por item. Numa
-- coluna, o sistema tenta casá-la com o organograma da prefeitura na hora de
-- aplicar: o que casa nasce atribuído, o que não casa continua em branco.
--
-- A regra de casamento mora no domínio (`SetorSugerido.ts`) e é tímida de
-- propósito: um único setor correspondente atribui; nenhum ou vários deixam em
-- branco. Responsável errado é pior que responsável ausente — ausente alguém
-- preenche, errado o item fica cobrado de quem não devia.

ALTER TABLE checklist_modelo_item ADD COLUMN setor_sugerido VARCHAR(120);

-- Texto livre, e não referência a `setor`: a sugestão vive no modelo global,
-- que não pertence a prefeitura nenhuma e não pode apontar para o organograma
-- de uma delas. Uma FK aqui seria o vazamento entre prefeituras que o projeto
-- inteiro evita.
ALTER TABLE checklist_modelo_item ADD CONSTRAINT checklist_modelo_item_setor_sugerido
  CHECK (setor_sugerido IS NULL OR btrim(setor_sugerido) <> '');

-- ---------------------------------------------------------------------------
-- A sugestão que já estava escrita, extraída para a coluna.
--
-- O texto termina em "Setor sugerido pelo TCE: X." — o `substring` pega o X, e
-- o `regexp_replace` tira o parágrafo inteiro da descrição, que agora ficaria
-- repetido na tela.

UPDATE checklist_modelo_item i
   SET setor_sugerido = btrim(
         substring(i.descricao FROM 'Setor sugerido pelo TCE:\s*([^.]+)')),
       descricao = nullif(btrim(
         regexp_replace(i.descricao, '\s*Setor sugerido pelo TCE:[^.]*\.', '')), '')
  FROM checklist_modelo m
 WHERE m.id = i.modelo_id
   AND m.orgao_id IS NULL
   AND i.descricao LIKE '%Setor sugerido pelo TCE:%';
