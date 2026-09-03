-- 0044 — Relatórios de processos: panorama, dossiê e setor.
--
-- A tabela guarda os **parâmetros** — tipo, período e filtros —, nunca o
-- resultado. Relatório é pergunta salva, não retrato.
--
-- Gravar os números significaria que reabrir o relatório de ontem mostraria
-- dados de ontem enquanto a tela ao lado mostra os de hoje, e ninguém saberia
-- qual está certo. Quem precisa do retrato **emite o documento**, que congela
-- os valores com timbre, assinatura e código de conferência — é exatamente para
-- isso que a peça existe.
--
-- É o mesmo desenho de `relatorio_consumo`, da 0028, e por boa razão: lá a
-- apuração também é recalculada a cada leitura, e nunca houve dúvida sobre qual
-- número vale.
--
-- Os filtros ficam em JSONB porque variam por tipo: o panorama aceita unidade,
-- fornecedor e modalidade; o dossiê aceita um processo; o de setor aceita um
-- setor. Três colunas nulas na maior parte das linhas seriam a mesma coisa com
-- mais cerimônia — e a cada filtro novo, uma migration.

CREATE TABLE relatorio_processo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id        UUID NOT NULL REFERENCES orgao(id),
  tipo            VARCHAR(20) NOT NULL
                    CHECK (tipo IN ('PANORAMA', 'DOSSIE', 'SETOR')),
  periodo_inicio  DATE NOT NULL,
  periodo_fim     DATE NOT NULL,
  -- unidadeId, fornecedorId, modalidade, processoId, setorId — o que o tipo
  -- pedir. Vazio é um filtro ausente, não um filtro nulo.
  filtros         JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por      UUID REFERENCES usuario(id),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Período invertido devolveria relatório vazio, e quem lê concluiria que não
  -- houve movimento — o pior jeito de errar num relatório.
  CHECK (periodo_fim >= periodo_inicio)
);
CREATE INDEX idx_relatorio_processo_orgao ON relatorio_processo(orgao_id, criado_em DESC);

ALTER TABLE documento_modelo DROP CONSTRAINT IF EXISTS documento_modelo_escopo_check;
ALTER TABLE documento_modelo
  ADD CONSTRAINT documento_modelo_escopo_check
  CHECK (escopo IN (
    'PROCESSO', 'PROCESSO_CONTRATO', 'ORDEM_FORNECIMENTO', 'SOLICITACAO',
    'BEM', 'TRANSFERENCIA_BEM', 'BAIXA_BEM', 'INVENTARIO',
    'VIAGEM', 'MANUTENCAO',
    'SOLICITACAO_ESTOQUE', 'ENTRADA_ESTOQUE', 'DEVOLUCAO_ESTOQUE',
    'RELATORIO_CONSUMO', 'CHECKLIST',
    'RELATORIO_PANORAMA', 'RELATORIO_SETOR'
  ));

-- O dossiê não ganha escopo próprio: ele fala de um processo com contrato, que
-- é exatamente o que `PROCESSO_CONTRATO` já entrega. Escopo custa código —
-- consulta, catálogo de marcadores e fonte de contexto —, e `tipo` não custa
-- nada.

INSERT INTO documento_modelo (orgao_id, modulo, escopo, tipo, nome, titulo, corpo)
VALUES

(NULL, 'PROCESSOS', 'RELATORIO_PANORAMA', 'RELATORIO_PANORAMA',
 'Panorama de contratos e licitações', 'RELATÓRIO DE CONTRATOS E LICITAÇÕES',
$corpo$<p>Período apurado: <strong>{{relatorio.periodo}}</strong>{{relatorio.filtros}}</p>
<table>
<tbody>
<tr><th style="width: 34%">Licitações no período</th><td>{{relatorio.licitacoes}}</td></tr>
<tr><th>Contratos firmados</th><td>{{relatorio.contratos}}</td></tr>
<tr><th>Fornecedores contratados</th><td>{{relatorio.fornecedores}}</td></tr>
<tr><th>Valor contratado</th><td>R$ {{relatorio.valorContratado}}</td></tr>
<tr><th>Valor pedido em solicitações</th><td>R$ {{relatorio.valorPedido}}</td></tr>
<tr><th>Saldo dos contratos</th><td><strong>R$ {{relatorio.saldo}}</strong></td></tr>
</tbody>
</table>
<h3>CONTRATOS</h3>
<table>
<thead>
<tr><th>Contrato</th><th>Fornecedor</th><th>Objeto</th><th>Contratado</th><th>Pedido</th><th>Saldo</th></tr>
</thead>
<tbody>
{{#contratos}}
<tr>
<td>{{numero}}</td><td>{{fornecedor}}</td><td>{{objeto}}</td>
<td>R$ {{valorContratado}}</td><td>R$ {{valorPedido}}</td><td>R$ {{saldo}}</td>
</tr>
{{/contratos}}
</tbody>
</table>
<h3>LICITAÇÕES</h3>
<table>
<thead>
<tr><th>Licitação</th><th>Modalidade</th><th>Objeto</th><th>Valor</th><th>Contratos</th></tr>
</thead>
<tbody>
{{#licitacoes}}
<tr>
<td>{{numero}}</td><td>{{modalidade}}</td><td>{{objeto}}</td>
<td>R$ {{valorTotal}}</td><td>{{contratos}}</td>
</tr>
{{/licitacoes}}
</tbody>
</table>
<h3>FORNECEDORES</h3>
<table>
<thead>
<tr><th>Fornecedor</th><th>CNPJ/CPF</th><th>Contratos</th><th>Contratado</th><th>Pedido</th></tr>
</thead>
<tbody>
{{#fornecedores}}
<tr>
<td>{{razaoSocial}}</td><td>{{documento}}</td><td>{{contratos}}</td>
<td>R$ {{valorContratado}}</td><td>R$ {{valorPedido}}</td>
</tr>
{{/fornecedores}}
</tbody>
</table>
<h3>UNIDADES</h3>
<table>
<thead>
<tr><th>Unidade</th><th>Contratos</th><th>Processos</th><th>Pedido</th></tr>
</thead>
<tbody>
{{#unidades}}
<tr>
<td>{{nome}}</td><td>{{contratos}}</td><td>{{processos}}</td><td>R$ {{valorPedido}}</td>
</tr>
{{/unidades}}
</tbody>
</table>
<p><small>O valor pedido soma as solicitações registradas; não representa
pagamento — o sistema registra a ordem de fornecimento, não a liquidação.</small></p>$corpo$),

(NULL, 'PROCESSOS', 'RELATORIO_SETOR', 'RELATORIO_SETOR',
 'Tramitação por setor', 'RELATÓRIO DE TRAMITAÇÃO POR SETOR',
$corpo$<p>Período apurado: <strong>{{relatorio.periodo}}</strong></p>
<table>
<tbody>
<tr><th style="width: 34%">Processos que entraram</th><td>{{relatorio.entraram}}</td></tr>
<tr><th>Processos que saíram</th><td>{{relatorio.sairam}}</td></tr>
<tr><th>Ainda no setor</th><td><strong>{{relatorio.parados}}</strong></td></tr>
</tbody>
</table>
<h3>POR SETOR</h3>
<table>
<thead>
<tr><th>Setor</th><th>Entraram</th><th>Saíram</th><th>Ainda no setor</th><th>Dias em média</th><th>Mais antigo</th></tr>
</thead>
<tbody>
{{#setores}}
<tr>
<td>{{nome}}</td><td>{{entraram}}</td><td>{{sairam}}</td>
<td>{{parados}}</td><td>{{diasMedia}}</td><td>{{diasMaisAntigo}}</td>
</tr>
{{/setores}}
</tbody>
</table>
<p><small>O tempo sai dos despachos: da entrada no setor até a saída, ou até
hoje quando o processo ainda não saiu.</small></p>$corpo$);
