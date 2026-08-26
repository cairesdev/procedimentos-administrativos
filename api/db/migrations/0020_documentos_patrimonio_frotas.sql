-- 0020 — Peças de patrimônio e frotas.
--
-- O motor de documentos é genérico desde 0014: o que faltava para os outros
-- módulos era o ESCOPO — de onde a peça fala — e o modelo global de cada uma.
-- Escopo custa código (uma consulta de contexto e um catálogo de marcadores);
-- `tipo` não custa nada, e a prefeitura cria quantos quiser pelo painel.

ALTER TABLE documento_modelo DROP CONSTRAINT documento_modelo_escopo_check;

ALTER TABLE documento_modelo ADD CONSTRAINT documento_modelo_escopo_check
  CHECK (escopo IN (
    'PROCESSO', 'PROCESSO_CONTRATO', 'ORDEM_FORNECIMENTO', 'SOLICITACAO',
    'BEM', 'TRANSFERENCIA_BEM', 'BAIXA_BEM', 'INVENTARIO',
    'VIAGEM', 'MANUTENCAO'
  ));

-- ---------------------------------------------------------------------------
-- Modelos globais. Mesma regra de 0015: orgao_id nulo é o padrão do produto, a
-- prefeitura que editar ganha linha própria, e ON CONFLICT DO NOTHING impede
-- que rodar de novo sobrescreva ajuste já feito no painel.

INSERT INTO documento_modelo (orgao_id, modulo, escopo, tipo, nome, titulo, corpo)
VALUES

-- ---- Patrimônio ----------------------------------------------------------

(NULL, 'PATRIMONIO', 'BEM', 'TERMO_RESPONSABILIDADE',
 'Termo de responsabilidade', 'TERMO DE RESPONSABILIDADE POR BEM PATRIMONIAL',
$corpo$<p>Declaro, para os devidos fins, que recebi da <strong>{{orgao.nome}}</strong>, CNPJ nº {{orgao.cnpj}}, o bem patrimonial abaixo identificado, comprometendo-me a zelar pela sua guarda e conservação, a utilizá-lo exclusivamente no interesse do serviço público e a comunicar de imediato ao setor de patrimônio qualquer dano, extravio ou necessidade de transferência.</p>
<table>
<tbody>
<tr><th style="width: 30%">Tombamento</th><td>{{bem.tombamento}}</td></tr>
<tr><th>Descrição</th><td>{{bem.nome}}</td></tr>
<tr><th>Categoria</th><td>{{bem.categoria}}</td></tr>
<tr><th>Estado de conservação</th><td>{{bem.estadoConservacao}}</td></tr>
<tr><th>Local</th><td>{{bem.localAtual}}</td></tr>
<tr><th>Entrada no patrimônio</th><td>{{bem.dataEntrada}}</td></tr>
<tr><th>Nota fiscal</th><td>{{bem.notaFiscal}}</td></tr>
<tr><th>Fornecedor</th><td>{{bem.fornecedor}}</td></tr>
</tbody>
</table>
<p>Estou ciente de que a responsabilidade pela guarda do bem permanece comigo enquanto ele estiver lotado no local acima, e de que sua movimentação depende de transferência formal registrada no sistema.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>
<p style="text-align: center">_______________________________________<br>Responsável pelo local</p>$corpo$),

(NULL, 'PATRIMONIO', 'TRANSFERENCIA_BEM', 'TERMO_TRANSFERENCIA',
 'Termo de transferência', 'TERMO DE TRANSFERÊNCIA DE BEM PATRIMONIAL',
$corpo$<p>Registra-se a transferência do bem patrimonial abaixo identificado entre locais desta Administração, nos termos do controle patrimonial vigente. O código de tombamento <strong>não se altera</strong> com a transferência: ele pertence ao local de origem do bem, que permanece sendo {{bem.localTombamento}}.</p>
<table>
<tbody>
<tr><th style="width: 30%">Tombamento</th><td>{{bem.tombamento}}</td></tr>
<tr><th>Descrição</th><td>{{bem.nome}}</td></tr>
<tr><th>Categoria</th><td>{{bem.categoria}}</td></tr>
<tr><th>Estado de conservação</th><td>{{bem.estadoConservacao}}</td></tr>
</tbody>
</table>
<table>
<tbody>
<tr><th style="width: 30%">Local de origem</th><td>{{transferencia.localOrigem}}</td></tr>
<tr><th>Local de destino</th><td>{{transferencia.localDestino}}</td></tr>
<tr><th>Situação</th><td>{{transferencia.status}}</td></tr>
<tr><th>Enviado por</th><td>{{transferencia.enviadoPor}} em {{transferencia.dataEnvio}}</td></tr>
<tr><th>Aceito por</th><td>{{transferencia.aceitoPor}} em {{transferencia.dataAceite}}</td></tr>
</tbody>
</table>
<p>A partir do aceite, a guarda e a conservação do bem passam ao responsável pelo local de destino.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>
<table>
<tbody>
<tr><td style="width: 50%; text-align: center">_______________________________<br>Responsável pela origem</td><td style="width: 50%; text-align: center">_______________________________<br>Responsável pelo destino</td></tr>
</tbody>
</table>$corpo$),

(NULL, 'PATRIMONIO', 'BAIXA_BEM', 'TERMO_BAIXA',
 'Termo de baixa', 'TERMO DE BAIXA DE BEM PATRIMONIAL',
$corpo$<p>Fica formalizada a baixa do bem patrimonial abaixo identificado do acervo da <strong>{{orgao.nome}}</strong>, CNPJ nº {{orgao.cnpj}}, permanecendo o registro no histórico patrimonial para fins de prestação de contas.</p>
<table>
<tbody>
<tr><th style="width: 30%">Tombamento</th><td>{{bem.tombamento}}</td></tr>
<tr><th>Descrição</th><td>{{bem.nome}}</td></tr>
<tr><th>Categoria</th><td>{{bem.categoria}}</td></tr>
<tr><th>Último local</th><td>{{bem.localAtual}}</td></tr>
<tr><th>Estado de conservação</th><td>{{bem.estadoConservacao}}</td></tr>
<tr><th>Entrada no patrimônio</th><td>{{bem.dataEntrada}}</td></tr>
</tbody>
</table>
<table>
<tbody>
<tr><th style="width: 30%">Motivo da baixa</th><td>{{baixa.motivo}}</td></tr>
<tr><th>Data</th><td>{{baixa.data}}</td></tr>
<tr><th>Responsável</th><td>{{baixa.responsavel}}</td></tr>
<tr><th>Observação</th><td>{{baixa.observacao}}</td></tr>
</tbody>
</table>
<p>O código de tombamento {{bem.tombamento}} <strong>não retorna ao estoque de numeração</strong> e não será reaproveitado por outro bem.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>
<p style="text-align: center">_______________________________________<br>Responsável pelo patrimônio</p>$corpo$),

(NULL, 'PATRIMONIO', 'INVENTARIO', 'FOLHA_INVENTARIO',
 'Folha de inventário', 'INVENTÁRIO DE BENS PATRIMONIAIS',
$corpo$<table>
<tbody>
<tr><th style="width: 30%">Local</th><td>{{inventario.local}}</td></tr>
<tr><th>Situação</th><td>{{inventario.status}}</td></tr>
<tr><th>Início</th><td>{{inventario.dataInicio}}</td></tr>
<tr><th>Conclusão</th><td>{{inventario.dataConclusao}}</td></tr>
<tr><th>Bens relacionados</th><td>{{inventario.totalBens}}</td></tr>
<tr><th>Encontrados</th><td>{{inventario.encontrados}}</td></tr>
<tr><th>Não encontrados</th><td>{{inventario.naoEncontrados}}</td></tr>
</tbody>
</table>
<table>
<thead>
<tr><th>Item</th><th>Tombamento</th><th>Descrição</th><th>Categoria</th><th>Situação</th><th>Estado</th><th>Observação</th></tr>
</thead>
<tbody>
{{#bens}}<tr><td>{{indice}}</td><td>{{tombamento}}</td><td>{{nome}}</td><td>{{categoria}}</td><td>{{situacao}}</td><td>{{estadoObservado}}</td><td>{{observacao}}</td></tr>{{/bens}}
</tbody>
</table>
<p>Declaro que a conferência física dos bens acima relacionados foi realizada no local indicado, e que as situações registradas correspondem ao que foi encontrado.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>
<p style="text-align: center">_______________________________________<br>Responsável pela conferência</p>$corpo$),

-- ---- Frotas --------------------------------------------------------------

(NULL, 'FROTAS', 'VIAGEM', 'AUTORIZACAO_VIAGEM',
 'Autorização de viagem', 'AUTORIZAÇÃO DE VIAGEM',
$corpo$<p>Autorizo a saída do veículo oficial abaixo identificado, conduzido pelo motorista indicado, para atender à finalidade descrita, observadas as normas de uso da frota municipal.</p>
<table>
<tbody>
<tr><th style="width: 30%">Veículo</th><td>{{veiculo.modelo}} — placa {{veiculo.placa}}</td></tr>
<tr><th>Ano / tipo</th><td>{{veiculo.ano}} / {{veiculo.tipo}}</td></tr>
<tr><th>Lotação do veículo</th><td>{{veiculo.unidade}}</td></tr>
<tr><th>Hodômetro atual</th><td>{{veiculo.quilometragemAtual}} km</td></tr>
</tbody>
</table>
<table>
<tbody>
<tr><th style="width: 30%">Motorista</th><td>{{motorista.nome}}</td></tr>
<tr><th>CNH</th><td>{{motorista.cnh}} — categoria {{motorista.categoriaCnh}}, válida até {{motorista.validadeCnh}}</td></tr>
</tbody>
</table>
<table>
<tbody>
<tr><th style="width: 30%">Unidade solicitante</th><td>{{viagem.unidadeSolicitante}}</td></tr>
<tr><th>Responsável</th><td>{{viagem.responsavel}}</td></tr>
<tr><th>Data e hora</th><td>{{viagem.dataHoraDesejada}}</td></tr>
<tr><th>Remarcada para</th><td>{{viagem.dataHoraRemarcada}}</td></tr>
<tr><th>Situação</th><td>{{viagem.status}}</td></tr>
<tr><th>Finalidade</th><td>{{viagem.motivo}}</td></tr>
</tbody>
</table>
<p>O condutor deve registrar a quilometragem na retirada e na devolução do veículo, e comunicar de imediato qualquer sinistro ocorrido durante o percurso.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>
<table>
<tbody>
<tr><td style="width: 50%; text-align: center">_______________________________<br>Autoridade competente</td><td style="width: 50%; text-align: center">_______________________________<br>Motorista</td></tr>
</tbody>
</table>$corpo$),

(NULL, 'FROTAS', 'VIAGEM', 'ORDEM_ABASTECIMENTO',
 'Ordem de abastecimento', 'ORDEM DE ABASTECIMENTO',
$corpo$<p>Autorizo o abastecimento do veículo oficial abaixo identificado, por conta da <strong>{{orgao.nome}}</strong>, CNPJ nº {{orgao.cnpj}}, vinculado à viagem em referência.</p>
<table>
<tbody>
<tr><th style="width: 30%">Veículo</th><td>{{veiculo.modelo}} — placa {{veiculo.placa}}</td></tr>
<tr><th>Motorista</th><td>{{motorista.nome}} — CNH {{motorista.cnh}}</td></tr>
<tr><th>Unidade solicitante</th><td>{{viagem.unidadeSolicitante}}</td></tr>
<tr><th>Finalidade da viagem</th><td>{{viagem.motivo}}</td></tr>
<tr><th>Saída</th><td>{{retirada.dataHora}} — {{retirada.kmInicial}} km</td></tr>
<tr><th>Cota registrada na retirada</th><td>{{retirada.notaCombustivel}}</td></tr>
</tbody>
</table>
<table>
<thead>
<tr><th>Item</th><th>Data</th><th>Litros</th><th>Valor</th></tr>
</thead>
<tbody>
{{#abastecimentos}}<tr><td>{{indice}}</td><td>{{data}}</td><td>{{litros}}</td><td>{{valor}}</td></tr>{{/abastecimentos}}
<tr><th colspan="2">Total</th><th>{{viagem.totalLitros}}</th><th>{{viagem.totalCombustivel}}</th></tr>
</tbody>
</table>
<p>O fornecedor deve conferir a placa do veículo antes do abastecimento e anexar o cupom fiscal à presente ordem.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>
<p style="text-align: center">_______________________________________<br>Responsável pela frota</p>$corpo$),

(NULL, 'FROTAS', 'VIAGEM', 'RELATORIO_VIAGEM',
 'Relatório de viagem', 'RELATÓRIO DE VIAGEM',
$corpo$<table>
<tbody>
<tr><th style="width: 30%">Veículo</th><td>{{veiculo.modelo}} — placa {{veiculo.placa}}</td></tr>
<tr><th>Motorista</th><td>{{motorista.nome}}</td></tr>
<tr><th>Unidade solicitante</th><td>{{viagem.unidadeSolicitante}}</td></tr>
<tr><th>Responsável</th><td>{{viagem.responsavel}}</td></tr>
<tr><th>Finalidade</th><td>{{viagem.motivo}}</td></tr>
<tr><th>Situação</th><td>{{viagem.status}}</td></tr>
</tbody>
</table>
<table>
<tbody>
<tr><th style="width: 30%">Retirada</th><td>{{retirada.dataHora}} — {{retirada.kmInicial}} km</td></tr>
<tr><th>Devolução</th><td>{{finalizacao.dataHora}} — {{finalizacao.kmFinal}} km</td></tr>
<tr><th>Percorrido</th><td>{{viagem.kmPercorrido}} km</td></tr>
<tr><th>Combustível</th><td>{{viagem.totalLitros}} L — {{viagem.totalCombustivel}}</td></tr>
<tr><th>Sinistro</th><td>{{finalizacao.sinistro}}</td></tr>
</tbody>
</table>
<table>
<thead>
<tr><th>Item</th><th>Data</th><th>Litros</th><th>Valor</th></tr>
</thead>
<tbody>
{{#abastecimentos}}<tr><td>{{indice}}</td><td>{{data}}</td><td>{{litros}}</td><td>{{valor}}</td></tr>{{/abastecimentos}}
</tbody>
</table>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>
<p style="text-align: center">_______________________________________<br>{{motorista.nome}}</p>$corpo$),

(NULL, 'FROTAS', 'MANUTENCAO', 'ORDEM_MANUTENCAO',
 'Ordem de manutenção', 'ORDEM DE MANUTENÇÃO DE VEÍCULO',
$corpo$<p>Autorizo a execução dos serviços de manutenção no veículo oficial abaixo identificado, que permanece indisponível para viagens enquanto a manutenção estiver em aberto.</p>
<table>
<tbody>
<tr><th style="width: 30%">Veículo</th><td>{{veiculo.modelo}} — placa {{veiculo.placa}}</td></tr>
<tr><th>Ano / tipo</th><td>{{veiculo.ano}} / {{veiculo.tipo}}</td></tr>
<tr><th>Lotação</th><td>{{veiculo.unidade}}</td></tr>
<tr><th>Hodômetro</th><td>{{veiculo.quilometragemAtual}} km</td></tr>
</tbody>
</table>
<table>
<tbody>
<tr><th style="width: 30%">Natureza</th><td>{{manutencao.tipo}}</td></tr>
<tr><th>Oficina</th><td>{{manutencao.oficina}}</td></tr>
<tr><th>Entrada</th><td>{{manutencao.dataInicio}}</td></tr>
<tr><th>Encerramento</th><td>{{manutencao.dataFim}}</td></tr>
<tr><th>Situação</th><td>{{manutencao.status}}</td></tr>
<tr><th>Custo</th><td>{{manutencao.custo}} ({{manutencao.custoPorExtenso}})</td></tr>
</tbody>
</table>
<p><strong>SERVIÇOS:</strong> {{manutencao.descricao}}</p>
<p>Serviço não descrito nesta ordem depende de nova autorização antes de ser executado.</p>
<p style="text-align: center">{{orgao.municipio}}, {{orgao.uf}}, {{data.porExtenso}}</p>
<p style="text-align: center">_______________________________________<br>Responsável pela frota</p>$corpo$)

ON CONFLICT DO NOTHING;
