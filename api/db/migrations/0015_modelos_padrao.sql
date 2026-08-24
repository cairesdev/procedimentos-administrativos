-- Modelos globais das peças, decalcados dos documentos do sistema legado
-- (São Bernardo/MA e Alto Parnaíba/MA).
--
-- `orgao_id` nulo = padrão do produto. A prefeitura que precisar de outra
-- redação edita e passa a ter linha própria; quem não mexer segue estes.
-- Corrigir a redação aqui alcança todas de uma vez.
--
-- ON CONFLICT DO NOTHING: rodar a migration de novo não sobrescreve ajuste que
-- o painel do produto já tenha feito no texto padrão.

INSERT INTO documento_modelo (orgao_id, modulo, tipo, nome, titulo, corpo)
VALUES
(NULL, 'PROCESSOS', 'TERMO_AUTORIZACAO',
 'Termo de autorização', 'TERMO DE AUTORIZAÇÃO',
$corpo$<p>Determino o prosseguimento dos procedimentos administrativos cabíveis à execução do objeto e à realização da despesa autorizada, vinculada ao Processo Administrativo nº {{processo.numeroProcessoAdm}}, observando-se rigorosamente a legislação vigente, as cláusulas contratuais pactuadas e os princípios que regem a Administração Pública.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>$corpo$),

(NULL, 'PROCESSOS', 'DESPACHO',
 'Despacho', 'DESPACHO',
$corpo$<p>Nos autos do Processo Administrativo nº {{processo.numeroProcessoAdm}}, protocolo nº {{processo.numeroProtocolo}}, em trâmite no setor {{processo.setorAtual}}:</p>
<p>{{despacho.texto}}</p>
<p>Encaminhem-se os autos ao setor {{despacho.setorDestino}} para as providências cabíveis.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>$corpo$),

(NULL, 'PROCESSOS', 'DESPACHO_FISCAL',
 'Despacho do fiscal do contrato', 'DESPACHO DO FISCAL DO CONTRATO',
$corpo$<p>Após verificação da execução do <strong>Contrato nº {{contrato.numero}}</strong>, Empresa <strong>{{fornecedor.razaoSocial}}</strong>, inscrita no CNPJ/CPF sob o nº {{fornecedor.documento}}, referente ao objeto <strong>{{contrato.objeto}}</strong>, informo que os serviços/fornecimentos foram executados conforme as condições contratuais.</p>
<p>Dessa forma, encaminho os autos para as providências cabíveis.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>$corpo$),

(NULL, 'PROCESSOS', 'PARECER',
 'Parecer', 'PARECER',
$corpo$<p>Trata-se de análise dos autos do Processo Administrativo nº {{processo.numeroProcessoAdm}}, protocolo nº {{processo.numeroProtocolo}}, aberto em {{processo.dataAbertura}} e em trâmite no setor {{processo.setorAtual}}.</p>
<h3>CONCLUSÃO</h3>
<p>Manifestação: <strong>{{parecer.favoravel}}</strong>.</p>
<p>{{parecer.justificativa}}</p>
<p>Ressalta-se que o presente parecer possui caráter opinativo, limitando-se à análise documental constante dos autos, não substituindo os atos de gestão e execução de responsabilidade dos setores competentes.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>$corpo$),

(NULL, 'PROCESSOS', 'RELATORIO_CONTROLADORIA',
 'Relatório da controladoria', 'RELATÓRIO DA CONTROLADORIA',
$corpo$<p>O presente exame tem por finalidade apresentar parecer conclusivo acerca do processo de pagamento em referência, utilizando-se, para tanto, da análise das peças documentais que compõem os autos, bem como da verificação da regularidade dos atos administrativos praticados, em conformidade com a legislação vigente e os princípios que regem a Administração Pública.</p>
<p>O presente parecer limita-se aos elementos constantes dos autos do Processo Administrativo nº {{processo.numeroProcessoAdm}}, considerando a sequência dos atos administrativos regularmente praticados e a documentação apresentada para instrução do feito.</p>
<p>No caso em análise, trata-se de processo de pagamento em favor de <strong>{{fornecedor.razaoSocial}}</strong>, referente ao <strong>Contrato nº {{contrato.numero}}</strong>, cujo objeto consiste em {{contrato.objeto}}, visando atender às necessidades do setor.</p>
<h3>EXAME</h3>
<p>Os trabalhos foram desenvolvidos e fundamentados na Constituição Federal da República Federativa do Brasil de 1988, na Lei Federal nº 14.133, de 1º de abril de 2021, na Lei Complementar nº 123, de 14 de dezembro de 2006, quando aplicável, bem como nos princípios que regem a Administração Pública, especialmente os da legalidade, impessoalidade, moralidade, publicidade, eficiência, interesse público, planejamento, transparência e segregação de funções.</p>
<p>Em face da análise procedida, visando ao pagamento do fornecedor acima identificado, verificou-se a presença dos seguintes documentos nos autos:</p>
<ol>
<li>Ordem de Fornecimento/Ordem de Serviço;</li>
<li>Solicitação de Pagamento apresentada pelo fornecedor;</li>
<li>Nota Fiscal correspondente à despesa;</li>
<li>Certidões de Regularidade Fiscal e Trabalhista (Municipal, Estadual, Federal, FGTS e CNDT);</li>
<li>Parecer do Controle Interno encaminhando os autos à Contabilidade;</li>
<li>Comprovante de Validação da DANFE/Nota Fiscal;</li>
<li>Comprovantes de Validação das Certidões de Regularidade.</li>
</ol>
<p>Após exame da documentação acostada aos autos, constatou-se que os documentos apresentados encontram-se formalmente regulares e aptos a subsidiar o processamento da despesa e a realização do respectivo pagamento, observadas as disposições legais pertinentes.</p>
<h3>CONCLUSÃO</h3>
<p>Diante do exposto, esta Controladoria, no exercício de suas atribuições legais, manifesta-se <strong>{{parecer.favoravel}}</strong> ao prosseguimento do processo de pagamento em favor de {{fornecedor.razaoSocial}}, referente ao Contrato nº {{contrato.numero}}, por entender que os autos se encontram devidamente instruídos, atendendo aos requisitos legais e administrativos necessários para a liquidação e pagamento da despesa.</p>
<p>{{parecer.justificativa}}</p>
<p>Ressalta-se que o presente parecer possui caráter opinativo, limitando-se à análise documental constante dos autos, não substituindo os atos de gestão e execução de responsabilidade dos setores competentes.</p>
<p>Encaminhem-se os autos ao Setor de Contabilidade para as providências cabíveis.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>$corpo$),

(NULL, 'PROCESSOS', 'ORDEM_FORNECIMENTO',
 'Ordem de serviço/fornecimento', 'ORDEM DE SERVIÇO/FORNECIMENTO',
$corpo$<table>
<tbody>
<tr><th style="width: 30%">Ordem nº</th><td>{{ordem.numero}}</td></tr>
<tr><th>Contrato nº</th><td>{{contrato.numero}}</td></tr>
<tr><th>Processo administrativo nº</th><td>{{processo.numeroProcessoAdm}}</td></tr>
<tr><th>Origem</th><td>{{contrato.origem}} nº {{contrato.origemNumero}}</td></tr>
</tbody>
</table>
<table>
<tbody>
<tr><th style="width: 30%">Credor</th><td>{{fornecedor.razaoSocial}}</td></tr>
<tr><th>CNPJ/CPF</th><td>{{fornecedor.documento}}</td></tr>
<tr><th>Endereço</th><td>{{fornecedor.endereco}}</td></tr>
</tbody>
</table>
<p><strong>OBJETO:</strong> {{contrato.objeto}}</p>
<table>
<tbody>
<tr><th style="width: 30%">Nota de empenho</th><td>{{ordem.numeroEmpenho}}</td></tr>
<tr><th>Requisição</th><td>{{ordem.numeroRequisicao}}</td></tr>
<tr><th>Projeto/atividade</th><td>{{ordem.projetoAtividade}}</td></tr>
<tr><th>Elemento de despesa</th><td>{{ordem.elementoDespesa}}</td></tr>
<tr><th>Fonte de recursos</th><td>{{ordem.fonteRecurso}}</td></tr>
<tr><th>Parcelas</th><td>{{ordem.numeroParcelas}}</td></tr>
</tbody>
</table>
<table>
<thead>
<tr><th>Item</th><th>Discriminação</th><th>Und.</th><th>Quant.</th><th>Marca</th><th>V. unit.</th><th>V. total</th></tr>
</thead>
<tbody>
{{#itens}}<tr><td>{{indice}}</td><td>{{produto}}</td><td>{{unidadeMedida}}</td><td>{{quantidade}}</td><td>{{marca}}</td><td>{{valorUnitario}}</td><td>{{valorTotal}}</td></tr>{{/itens}}
<tr><th colspan="6">Valor total: {{ordem.valorPorExtenso}}</th><th>{{ordem.valor}}</th></tr>
</tbody>
</table>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>$corpo$),

(NULL, 'PROCESSOS', 'COMPROVANTE_SOLICITACAO',
 'Comprovante de solicitação', 'COMPROVANTE DE SOLICITAÇÃO DE ITENS',
$corpo$<table>
<tbody>
<tr><th style="width: 30%">Protocolo</th><td>{{processo.numeroProtocolo}}</td></tr>
<tr><th>Processo administrativo</th><td>{{processo.numeroProcessoAdm}}</td></tr>
<tr><th>Unidade solicitante</th><td>{{processo.unidadeSolicitante}}</td></tr>
<tr><th>Situação</th><td>{{solicitacao.situacao}}</td></tr>
<tr><th>Criada em</th><td>{{solicitacao.criadaEm}}</td></tr>
</tbody>
</table>
<table>
<thead>
<tr><th>Item</th><th>Produto</th><th>Und.</th><th>Quant.</th><th>V. unit.</th><th>V. total</th></tr>
</thead>
<tbody>
{{#itens}}<tr><td>{{indice}}</td><td>{{produto}}</td><td>{{unidadeMedida}}</td><td>{{quantidade}}</td><td>{{valorUnitario}}</td><td>{{valorTotal}}</td></tr>{{/itens}}
<tr><th colspan="5">Valor total: {{solicitacao.valorTotalPorExtenso}}</th><th>{{solicitacao.valorTotal}}</th></tr>
</tbody>
</table>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>$corpo$)

ON CONFLICT DO NOTHING;
