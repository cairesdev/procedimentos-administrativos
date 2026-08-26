-- 0022 — Peças do almoxarifado.
--
-- Os quatro documentos do ciclo, em dois escopos: um sobre o pedido (que serve
-- ao comprovante, ao romaneio e ao termo de recebimento) e um sobre a entrada.
-- Escopo custa código; `tipo` não custa nada — daí três peças num escopo só.

ALTER TABLE documento_modelo DROP CONSTRAINT documento_modelo_escopo_check;

ALTER TABLE documento_modelo ADD CONSTRAINT documento_modelo_escopo_check
  CHECK (escopo IN (
    'PROCESSO', 'PROCESSO_CONTRATO', 'ORDEM_FORNECIMENTO', 'SOLICITACAO',
    'BEM', 'TRANSFERENCIA_BEM', 'BAIXA_BEM', 'INVENTARIO',
    'VIAGEM', 'MANUTENCAO',
    'SOLICITACAO_ESTOQUE', 'ENTRADA_ESTOQUE'
  ));

INSERT INTO documento_modelo (orgao_id, modulo, escopo, tipo, nome, titulo, corpo)
VALUES

(NULL, 'ALMOXARIFADO', 'SOLICITACAO_ESTOQUE', 'COMPROVANTE_PEDIDO_MATERIAL',
 'Comprovante do pedido', 'COMPROVANTE DE PEDIDO DE MATERIAL',
$corpo$<p>Registra-se o pedido de material da unidade abaixo identificada ao almoxarifado da <strong>{{orgao.nome}}</strong>, CNPJ nº {{orgao.cnpj}}.</p>
<table>
<tbody>
<tr><th style="width: 30%">Unidade solicitante</th><td>{{pedido.local}}</td></tr>
<tr><th>Almoxarifado</th><td>{{pedido.almoxarifado}}</td></tr>
<tr><th>Tipo de estoque</th><td>{{pedido.tipoEstoque}}</td></tr>
<tr><th>Solicitante</th><td>{{pedido.autor}}</td></tr>
<tr><th>Aberto em</th><td>{{pedido.data}}</td></tr>
<tr><th>Enviado em</th><td>{{pedido.enviadoEm}}</td></tr>
<tr><th>Situação</th><td>{{pedido.status}}</td></tr>
</tbody>
</table>
<table>
<thead>
<tr><th>Item</th><th>Produto</th><th>Und.</th><th>Solicitado</th><th>Liberado</th><th>Recebido</th></tr>
</thead>
<tbody>
{{#itens}}<tr><td>{{indice}}</td><td>{{produto}}</td><td>{{unidadeMedida}}</td><td>{{solicitado}}</td><td>{{liberado}}</td><td>{{recebido}}</td></tr>{{/itens}}
</tbody>
</table>
<p>O envio do pedido reserva o saldo no almoxarifado. A reserva é devolvida se o pedido for cancelado, recusado ou se vencer o prazo definido pela Administração.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>
<p style="text-align: center">_______________________________________<br>{{pedido.autor}}</p>$corpo$),

(NULL, 'ALMOXARIFADO', 'SOLICITACAO_ESTOQUE', 'ROMANEIO_ENTREGA',
 'Romaneio de entrega', 'ROMANEIO DE ENTREGA DE MATERIAL',
$corpo$<p>Segue para a unidade abaixo o material relacionado, saído do almoxarifado <strong>{{pedido.almoxarifado}}</strong>. Confira lote a lote no ato do recebimento: cada linha tem validade própria.</p>
<table>
<tbody>
<tr><th style="width: 30%">Unidade de destino</th><td>{{pedido.local}}</td></tr>
<tr><th>CNPJ</th><td>{{pedido.cnpj}}</td></tr>
<tr><th>Endereço de entrega</th><td>{{pedido.endereco}}</td></tr>
<tr><th>Responsável pelo recebimento</th><td>{{pedido.responsavel}}</td></tr>
<tr><th>Liberado por</th><td>{{pedido.liberadoPor}} em {{pedido.liberadoEm}}</td></tr>
<tr><th>Volumes</th><td>{{pedido.totalLotes}} lote(s)</td></tr>
</tbody>
</table>
<table>
<thead>
<tr><th>Item</th><th>Produto</th><th>Und.</th><th>Remessa</th><th>Validade</th><th>Quantidade</th></tr>
</thead>
<tbody>
{{#lotes}}<tr><td>{{indice}}</td><td>{{produto}}</td><td>{{unidadeMedida}}</td><td>{{remessa}}</td><td>{{validade}}</td><td>{{quantidade}}</td></tr>{{/lotes}}
</tbody>
</table>
<p>Divergência entre o que consta neste romaneio e o que chegou deve ser registrada na confirmação de recebimento, com o motivo. A diferença é baixada como perda e não retorna ao almoxarifado.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>
<table>
<tbody>
<tr><td style="width: 50%; text-align: center">_______________________________<br>Entregue por</td><td style="width: 50%; text-align: center">_______________________________<br>Recebido por</td></tr>
</tbody>
</table>$corpo$),

(NULL, 'ALMOXARIFADO', 'SOLICITACAO_ESTOQUE', 'TERMO_RECEBIMENTO_MATERIAL',
 'Termo de recebimento', 'TERMO DE RECEBIMENTO DE MATERIAL',
$corpo$<p>Declaro que a unidade <strong>{{pedido.local}}</strong> recebeu do almoxarifado {{pedido.almoxarifado}} o material abaixo relacionado, conferido lote a lote na data indicada.</p>
<table>
<tbody>
<tr><th style="width: 30%">Unidade</th><td>{{pedido.local}}</td></tr>
<tr><th>CNPJ</th><td>{{pedido.cnpj}}</td></tr>
<tr><th>Liberado em</th><td>{{pedido.liberadoEm}} por {{pedido.liberadoPor}}</td></tr>
<tr><th>Recebido em</th><td>{{pedido.recebidoEm}} por {{pedido.recebidoPor}}</td></tr>
</tbody>
</table>
<table>
<thead>
<tr><th>Item</th><th>Produto</th><th>Und.</th><th>Validade</th><th>Saiu</th><th>Recebido</th><th>Falta</th><th>Motivo</th></tr>
</thead>
<tbody>
{{#lotes}}<tr><td>{{indice}}</td><td>{{produto}}</td><td>{{unidadeMedida}}</td><td>{{validade}}</td><td>{{quantidade}}</td><td>{{confirmado}}</td><td>{{perdido}}</td><td>{{motivoPerda}}</td></tr>{{/lotes}}
</tbody>
</table>
<p>As quantidades não confirmadas foram baixadas como perda, com o motivo registrado, e não retornaram ao saldo do almoxarifado.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>
<p style="text-align: center">_______________________________________<br>{{pedido.responsavel}}</p>$corpo$),

(NULL, 'ALMOXARIFADO', 'ENTRADA_ESTOQUE', 'COMPROVANTE_ENTRADA_ESTOQUE',
 'Comprovante de entrada', 'COMPROVANTE DE ENTRADA NO ALMOXARIFADO',
$corpo$<p>Registra-se a entrada do material abaixo no almoxarifado da <strong>{{orgao.nome}}</strong>, CNPJ nº {{orgao.cnpj}}.</p>
<table>
<tbody>
<tr><th style="width: 30%">Remessa</th><td>{{entrada.codigo}} — {{entrada.titulo}}</td></tr>
<tr><th>Almoxarifado</th><td>{{entrada.almoxarifado}}</td></tr>
<tr><th>Tipo de estoque</th><td>{{entrada.tipoEstoque}}</td></tr>
<tr><th>Data de entrada</th><td>{{entrada.data}}</td></tr>
<tr><th>Local armazenado</th><td>{{entrada.localArmazenado}}</td></tr>
<tr><th>Nota fiscal</th><td>{{entrada.notaFiscal}}</td></tr>
<tr><th>Fornecedor</th><td>{{entrada.fornecedor}}</td></tr>
<tr><th>Responsável</th><td>{{entrada.responsavel}}</td></tr>
</tbody>
</table>
<table>
<thead>
<tr><th>Item</th><th>Produto</th><th>Und.</th><th>Quantidade</th><th>Validade</th></tr>
</thead>
<tbody>
{{#lotes}}<tr><td>{{indice}}</td><td>{{produto}}</td><td>{{unidadeMedida}}</td><td>{{quantidade}}</td><td>{{validade}}</td></tr>{{/lotes}}
</tbody>
</table>
<p>Cada linha constitui um lote com saldo e validade próprios. A saída para as unidades segue a ordem de validade: o que vence primeiro é distribuído primeiro.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>
<p style="text-align: center">_______________________________________<br>{{entrada.responsavel}}</p>$corpo$)

ON CONFLICT DO NOTHING;
