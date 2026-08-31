-- 0032 — Comprovante de devolução.
--
-- Era a única movimentação do almoxarifado sem peça emitida: entrada, pedido e
-- relatório de consumo já tinham. A escola devolve material, o saldo sai do
-- armário dela na hora, e até agora ela não tinha papel nenhum dizendo isso.
--
-- Uma peça só serve aos três estados. O que muda entre a devolução pendente, a
-- aceita e a recusada é o bloco final — e um modelo por estado significaria
-- três textos para manter sincronizados, com a chance de a prefeitura corrigir
-- um e esquecer os outros dois.

ALTER TABLE documento_modelo DROP CONSTRAINT IF EXISTS documento_modelo_escopo_check;
ALTER TABLE documento_modelo
  ADD CONSTRAINT documento_modelo_escopo_check
  CHECK (escopo IN (
    'PROCESSO', 'PROCESSO_CONTRATO', 'ORDEM_FORNECIMENTO', 'SOLICITACAO',
    'BEM', 'TRANSFERENCIA_BEM', 'BAIXA_BEM', 'INVENTARIO',
    'VIAGEM', 'MANUTENCAO',
    'SOLICITACAO_ESTOQUE', 'ENTRADA_ESTOQUE', 'DEVOLUCAO_ESTOQUE',
    'RELATORIO_CONSUMO'
  ));

INSERT INTO documento_modelo (orgao_id, modulo, escopo, tipo, nome, titulo, corpo)
VALUES
(NULL, 'ALMOXARIFADO', 'DEVOLUCAO_ESTOQUE', 'COMPROVANTE_DEVOLUCAO',
 'Comprovante de devolução', 'COMPROVANTE DE DEVOLUÇÃO DE MATERIAL',
$corpo$<p>Registra-se a devolução de material da unidade abaixo identificada ao almoxarifado da <strong>{{orgao.nome}}</strong>, CNPJ nº {{orgao.cnpj}}.</p>
<table>
<tbody>
<tr><th style="width: 30%">Unidade</th><td>{{devolucao.local}}</td></tr>
<tr><th>Almoxarifado</th><td>{{devolucao.almoxarifado}}</td></tr>
<tr><th>Material</th><td>{{devolucao.produto}}</td></tr>
<tr><th>Quantidade</th><td>{{devolucao.quantidade}} {{devolucao.unidadeMedida}}</td></tr>
<tr><th>Validade do lote</th><td>{{devolucao.validade}}</td></tr>
<tr><th>Motivo</th><td>{{devolucao.motivo}}</td></tr>
<tr><th>Solicitada em</th><td>{{devolucao.data}}</td></tr>
<tr><th>Solicitada por</th><td>{{devolucao.solicitadaPor}}</td></tr>
<tr><th>Situação</th><td>{{devolucao.situacao}}</td></tr>
<tr><th>Respondida em</th><td>{{devolucao.respondidaEm}}</td></tr>
<tr><th>Respondida por</th><td>{{devolucao.aceitaPor}}</td></tr>
<tr><th>Motivo da recusa</th><td>{{devolucao.motivoRecusa}}</td></tr>
</tbody>
</table>
<p>O material deixou o estoque da unidade na data da solicitação. Só passa a compor o saldo do almoxarifado após o aceite; recusada a devolução, o saldo retorna à unidade.</p>
<p>&nbsp;</p>
<p style="text-align: center">_______________________________________<br />{{devolucao.solicitadaPor}}<br />{{devolucao.local}}</p>
<p>&nbsp;</p>
<p style="text-align: center">_______________________________________<br />Responsável pelo almoxarifado<br />{{devolucao.almoxarifado}}</p>$corpo$);
