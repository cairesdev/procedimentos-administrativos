-- 0038 — A liquidação e o pagamento ao fornecedor, como modelo global.
--
-- É a lista que a prefeitura monta toda vez que uma despesa vai da entrega ao
-- empenho: ordem de fornecimento emitida, fornecedor apresentando a cobrança e
-- a regularidade dela, controle interno dando o parecer, contabilidade
-- validando os documentos.
--
-- Global (`orgao_id IS NULL`), ao lado do PNTP. Estas sete etapas vêm da Lei
-- 14.133 e da instrução do Tribunal, não do organograma de um município — o
-- que muda de prefeitura para prefeitura é quem faz cada uma, e isso se define
-- na cópia, ao aplicar.
--
-- **Três itens são do fornecedor** (`para_fornecedor = TRUE`): a solicitação de
-- pagamento, a nota fiscal e as certidões. São os que aparecem no link externo
-- — o fornecedor abre o endereço, anexa e devolve, sem conta no sistema. Os
-- outros quatro são internos: quem emite a ordem, quem dá o parecer e quem
-- valida a DANFE e as certidões é a prefeitura.
--
-- Todos exigem anexo. Uma etapa marcada como cumprida sem o documento é
-- exatamente o que a prestação de contas não aceita: o processo de pagamento
-- vale pelas peças que carrega.
--
-- Sem prazo em dias de propósito. O relógio da liquidação começa em eventos
-- diferentes conforme o contrato — entrega, medição, aceite —, e um prazo
-- errado no modelo vira data errada em toda cópia. Quem aplica preenche.

INSERT INTO checklist_modelo (orgao_id, nome, descricao)
VALUES (NULL, 'Liquidação e pagamento ao fornecedor',
        'Documentos que instruem o processo de pagamento, da ordem de fornecimento à validação das certidões. Aplique por despesa: cada pagamento tem seus documentos e suas datas.');

INSERT INTO checklist_modelo_item
  (modelo_id, ordem, secao, titulo, descricao, exige_anexo, para_fornecedor)
SELECT m.id, v.* FROM (VALUES
  (1, 'Autorização da despesa',
   'Ordem de Fornecimento / Ordem de Serviço',
   'A peça que autoriza a despesa e delimita o que foi pedido. Emitida pelo setor de compras; anexe a via assinada.',
   TRUE, FALSE),

  (2, 'Cobrança do fornecedor',
   'Solicitação de Pagamento apresentada pelo fornecedor',
   'O pedido formal de pagamento, com a identificação do contrato e os dados bancários.',
   TRUE, TRUE),

  (3, 'Cobrança do fornecedor',
   'Nota Fiscal correspondente à despesa',
   'A nota da entrega ou do serviço. Confira se o valor e os itens batem com a ordem de fornecimento antes de aceitar.',
   TRUE, TRUE),

  (4, 'Cobrança do fornecedor',
   'Certidões de Regularidade Fiscal e Trabalhista',
   'Municipal, Estadual, Federal, FGTS e CNDT. Todas dentro da validade na data do pagamento — certidão vencida no dia do empenho não regulariza nada.',
   TRUE, TRUE),

  (5, 'Conferência interna',
   'Parecer do Controle Interno encaminhando os autos à Contabilidade',
   'A manifestação que libera o processo para o empenho.',
   TRUE, FALSE),

  (6, 'Conferência interna',
   'Comprovante de Validação da DANFE / Nota Fiscal',
   'A consulta à Sefaz que mostra a nota como autorizada. Anexe o comprovante, e não só o número.',
   TRUE, FALSE),

  (7, 'Conferência interna',
   'Comprovantes de Validação das Certidões de Regularidade',
   'A consulta a cada emissor, provando que a certidão apresentada é autêntica e está válida.',
   TRUE, FALSE)
) AS v(ordem, secao, titulo, descricao, exige_anexo, para_fornecedor)
 CROSS JOIN checklist_modelo m
 WHERE m.orgao_id IS NULL AND m.nome = 'Liquidação e pagamento ao fornecedor';
