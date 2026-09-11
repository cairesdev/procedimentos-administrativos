-- 0050 — A capa passa a imprimir o valor do processo, e não o do contrato.
--
-- A moldura da capa tem o rótulo "VALOR DO PROCESSO" e trazia
-- `{{contrato.valorTotal}}`. Os dois números não são o mesmo: um contrato
-- anual de fornecimento atende dezenas de processos, e quem abrisse a pasta de
-- um pedido de doze mil reais leria meio milhão — em corpo 22, dentro de uma
-- moldura, com o extenso embaixo. É o número que o Tribunal procura primeiro.
--
-- O valor do processo é a soma do que ele pediu: os itens da solicitação.
-- `solicitacao.processo_id` é chave primária, então há no máximo uma
-- solicitação por processo e a soma é direta.
--
-- Processo sem itens passa a valer R$ 0,00 na capa. É melhor que o valor do
-- contrato inteiro: zero é verdade sobre um processo que não pediu nada, e o
-- outro número era falso sobre todos.
--
-- ---------------------------------------------------------------------------
-- O TEXTO DA 0043 TAMBÉM FOI ACERTADO, E AS DUAS COISAS CONVERGEM
--
-- Esta migration conserta as bases que já semearam a capa. O `INSERT` da 0043
-- foi corrigido junto para que uma base nova nasça certa — do contrário, um
-- município instalado amanhã receberia o defeito e dependeria de um UPDATE
-- para corrigi-lo no segundo seguinte. O `WHERE` abaixo casa só com o texto
-- antigo, então numa base nova este comando não encontra linha nenhuma.
--
-- ---------------------------------------------------------------------------
-- SÓ O MODELO GLOBAL É TOCADO
--
-- `orgao_id IS NULL` é o padrão do produto. Prefeitura que personalizou a
-- própria capa fica como está: sobrescrever o texto dela seria desfazer, sem
-- aviso, um trabalho que alguém teve — e a personalização existe justamente
-- porque o timbre e as palavras variam de município para município.
--
-- Quem personalizou e quiser o conserto troca dois marcadores na tela de
-- modelos: `{{contrato.valorTotal}}` por `{{processo.valorTotal}}` e
-- `{{contrato.valorTotalPorExtenso}}` por `{{processo.valorTotalPorExtenso}}`.

UPDATE documento_modelo
   SET corpo = replace(
                 replace(corpo,
                         '{{contrato.valorTotalPorExtenso}}',
                         '{{processo.valorTotalPorExtenso}}'),
                 '{{contrato.valorTotal}}',
                 '{{processo.valorTotal}}'),
       updated_at = now()
 WHERE orgao_id IS NULL
   AND tipo = 'CAPA_PROCESSO'
   AND corpo LIKE '%{{contrato.valorTotal%';
