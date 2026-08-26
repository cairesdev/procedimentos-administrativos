-- 0024 — Ordem de Serviço, decalcada do modelo de Alto Parnaíba/MA.
--
-- O sistema já tinha ORDEM_FORNECIMENTO, montada a partir da Ordem de Compras
-- de São Bernardo. São peças diferentes: aquela é um bloco corrido de tabelas,
-- esta é numerada em cinco seções (contratado, contratante, despesa,
-- observações com os itens, assinaturas). As duas convivem no mesmo escopo —
-- escopo custa código, `tipo` não custa nada.

INSERT INTO documento_modelo (orgao_id, modulo, escopo, tipo, nome, titulo, corpo)
VALUES

(NULL, 'PROCESSOS', 'ORDEM_FORNECIMENTO', 'ORDEM_SERVICO',
 'Ordem de serviço', 'ORDEM DE SERVIÇO',
$corpo$<p style="text-align: center"><strong>O.S. Nº {{ordem.numero}}</strong></p>
<h3>1. EMPRESA / CONTRATADO(A)</h3>
<table>
<tbody>
<tr><th style="width: 22%">1.1. Nome</th><td colspan="3">{{fornecedor.razaoSocial}}</td></tr>
<tr><th>1.2. Endereço</th><td colspan="3">{{fornecedor.endereco}}</td></tr>
<tr><th>1.3. CNPJ/CPF</th><td style="width: 28%">{{fornecedor.documento}}</td><th style="width: 22%">1.4. Inscrição Estadual</th><td>{{fornecedor.inscricaoEstadual}}</td></tr>
<tr><th>1.5. Inscrição Municipal</th><td>{{fornecedor.inscricaoMunicipal}}</td><th>1.6. Contato</th><td>{{fornecedor.telefone}} {{fornecedor.email}}</td></tr>
</tbody>
</table>
<h3>2. DADOS DA CONTRATANTE</h3>
<table>
<tbody>
<tr><th style="width: 22%">2.1. Nome</th><td colspan="3">{{contratante.nome}}</td></tr>
<tr><th>2.2. Endereço</th><td colspan="3">{{contratante.endereco}}</td></tr>
<tr><th>2.3. Cidade</th><td style="width: 28%">{{contratante.cidade}}</td><th style="width: 22%">2.4. CNPJ/CPF</th><td>{{contratante.cnpj}}</td></tr>
<tr><th>2.5. Inscrição Estadual</th><td>{{contratante.inscricaoEstadual}}</td><th>2.6. Inscrição Municipal</th><td>{{contratante.inscricaoMunicipal}}</td></tr>
</tbody>
</table>
<h3>3. DADOS DA DESPESA</h3>
<table>
<tbody>
<tr><th style="width: 22%">3.1. Processo nº</th><td style="width: 28%">{{processo.numeroProcessoAdm}}</td><th style="width: 22%">3.2. Nota de Empenho</th><td>{{ordem.numeroEmpenho}}</td></tr>
<tr><th>3.3. Requisição</th><td>{{ordem.numeroRequisicao}}</td><th>3.4. Projeto/Atividade</th><td>{{ordem.projetoAtividade}}</td></tr>
<tr><th>3.5. Elemento de Despesa</th><td>{{ordem.elementoDespesa}}</td><th>3.6. Fonte de Recursos</th><td>{{ordem.fonteRecurso}}</td></tr>
<tr><th>3.7. Valor</th><td colspan="3">R$ {{ordem.valor}} ({{ordem.valorPorExtenso}})</td></tr>
<tr><th>3.8. Nº de Parcelas</th><td>{{ordem.numeroParcelas}}</td><th>3.9. Contrato nº</th><td>{{contrato.numero}}</td></tr>
<tr><th>3.10. Vigência do contrato</th><td>{{contrato.dataInicio}} a {{contrato.dataFim}}</td><th>3.11. Fiscal</th><td>{{contrato.fiscal}}</td></tr>
<tr><th>3.12. {{contrato.origem}} nº</th><td>{{contrato.origemNumero}}</td><th>3.13. Modalidade</th><td>{{contrato.modalidade}}</td></tr>
</tbody>
</table>
<h3>4. OBSERVAÇÕES</h3>
<p>{{contrato.objeto}}</p>
<table>
<thead>
<tr><th>ITEM</th><th>DESCRIÇÃO</th><th>UNID.</th><th>QTD.</th><th>V. UNIT.</th><th>V. TOTAL</th></tr>
</thead>
<tbody>
{{#itens}}<tr><td>{{indice}}</td><td>{{produto}}</td><td>{{unidadeMedida}}</td><td>{{quantidade}}</td><td>R$ {{valorUnitario}}</td><td>R$ {{valorTotal}}</td></tr>{{/itens}}
<tr><th colspan="5">TOTAL DA NOTA</th><th>R$ {{ordem.valor}}</th></tr>
</tbody>
</table>
<h3>5. ASSINATURAS</h3>
<p style="text-align: center">{{orgao.municipio}} – {{orgao.uf}}, {{data.curta}}</p>
<table>
<tbody>
<tr>
<td style="width: 33%; text-align: center">_______________________________<br>5.1. RESPONSÁVEL</td>
<td style="width: 34%; text-align: center">_______________________________<br>5.2. ORDENADOR DE DESPESA</td>
<td style="width: 33%; text-align: center">_______________________________<br>5.3. FORNECEDOR</td>
</tr>
</tbody>
</table>
<p><small>Emitida por {{autor.nome}} — {{autor.cargo}}. Documento nº {{documento.codigo}}.</small></p>$corpo$)

ON CONFLICT DO NOTHING;
