-- 0034 — A declaração de conclusão do checklist.
--
-- Escopo novo no motor que já existe, e não máquina nova: a peça sai pelo
-- mesmo caminho do comprovante de devolução e do relatório de consumo, com
-- código de conferência pública e corpo editável pela prefeitura.
--
-- `CHECKLIST` entra também no CHECK de módulo de `documento_modelo`: o escopo
-- pertence ao módulo novo, e sem isto o modelo não poderia ser gravado.

ALTER TABLE documento_modelo DROP CONSTRAINT documento_modelo_modulo_check;
ALTER TABLE documento_modelo ADD CONSTRAINT documento_modelo_modulo_check
  CHECK (modulo IN ('PROCESSOS', 'PATRIMONIO', 'FROTAS', 'ALMOXARIFADO', 'CHECKLIST'));

ALTER TABLE documento_modelo DROP CONSTRAINT IF EXISTS documento_modelo_escopo_check;
ALTER TABLE documento_modelo
  ADD CONSTRAINT documento_modelo_escopo_check
  CHECK (escopo IN (
    'PROCESSO', 'PROCESSO_CONTRATO', 'ORDEM_FORNECIMENTO', 'SOLICITACAO',
    'BEM', 'TRANSFERENCIA_BEM', 'BAIXA_BEM', 'INVENTARIO',
    'VIAGEM', 'MANUTENCAO',
    'SOLICITACAO_ESTOQUE', 'ENTRADA_ESTOQUE', 'DEVOLUCAO_ESTOQUE',
    'RELATORIO_CONSUMO', 'CHECKLIST'
  ));

INSERT INTO documento_modelo (orgao_id, modulo, escopo, tipo, nome, titulo, corpo)
VALUES
(NULL, 'CHECKLIST', 'CHECKLIST', 'DECLARACAO_CHECKLIST',
 'Declaração de conclusão', 'DECLARAÇÃO DE CUMPRIMENTO DE EXIGÊNCIAS',
$corpo$<p>A <strong>{{orgao.nome}}</strong>, CNPJ nº {{orgao.cnpj}}, declara que as exigências abaixo relacionadas encontram-se cumpridas na data de emissão desta peça.</p>
<table>
<tbody>
<tr><th style="width: 30%">Checklist</th><td>{{checklist.titulo}}</td></tr>
<tr><th>Referente a</th><td>{{checklist.alvo}}</td></tr>
<tr><th>Responsável</th><td>{{checklist.responsavel}}</td></tr>
<tr><th>Aberto em</th><td>{{checklist.criadoEm}}</td></tr>
<tr><th>Aberto por</th><td>{{checklist.criadoPor}}</td></tr>
<tr><th>Itens</th><td>{{checklist.totalItens}}</td></tr>
<tr><th>Completo em</th><td>{{checklist.completoEm}}</td></tr>
</tbody>
</table>
<table>
<thead>
<tr><th>Exigência</th><th>Situação</th><th>Cumprida em</th><th>Por</th><th>Conferida por</th><th>Válida até</th></tr>
</thead>
<tbody>
{{#itens}}<tr><td>{{titulo}}</td><td>{{situacao}}</td><td>{{cumpridoEm}}</td><td>{{cumpridoPor}}</td><td>{{conferidoPor}}</td><td>{{vigenciaAte}}</td></tr>{{/itens}}
</tbody>
</table>
<p>Os itens marcados com prazo de validade permanecem cumpridos até a data indicada, quando voltam a ser exigíveis. Esta declaração refere-se à situação verificada na data de sua emissão.</p>
<p>&nbsp;</p>
<p style="text-align: center">_______________________________________<br />{{checklist.responsavel}}</p>$corpo$);
