-- 0028 — Relatório de consumo da alimentação escolar (PNAE).
--
-- A 2ª fatia do almoxarifado passou a registrar consumo, perda e devolução por
-- unidade. O dado existia e nenhuma tela o lia: quem presta contas ao FNDE
-- refazia a conta na planilha, a partir dos comprovantes impressos.
--
-- O relatório é **movimento físico**, em quantidade. Valor ficou de fora por
-- decisão: a entrada da remessa registra quantidade e não tem preço, e
-- inventar um custo médio aqui produziria número que ninguém consegue defender
-- diante do conselho de alimentação escolar.

-- ---------------------------------------------------------------------------
-- Agricultura familiar
--
-- O FNDE exige 30% do repasse aplicados em agricultura familiar. É atributo do
-- fornecedor, não da compra: uma cooperativa de agricultores é a mesma em
-- qualquer município — por isso a coluna cabe no cadastro GLOBAL.
--
-- `fornecedor` não tem `orgao_id` de propósito (decisão do levantamento), e
-- toda alteração passa por `fornecedor_historico`. Marcar aqui vale para todas
-- as prefeituras, e a mudança fica registrada como qualquer outra.
ALTER TABLE fornecedor
  ADD COLUMN agricultura_familiar BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN fornecedor.agricultura_familiar IS
  'Cooperativa ou produtor da agricultura familiar — os 30% que o FNDE cobra.';

-- ---------------------------------------------------------------------------
-- O relatório
--
-- Guarda os PARÂMETROS da apuração, não os números.
--
-- O motor de documentos emite por referência a uma entidade, e um relatório de
-- período não tinha nenhuma. Esta tabela é essa entidade: nasce com o recorte
-- pedido, e a peça emitida sobre ela congela o resultado em
-- `documento_emitido.dados` — como já acontece com toda peça do sistema.
--
-- Guardar os números aqui seria duplicá-los: o retrato da peça já é imutável,
-- e o relatório aberto tem de refletir o estoque de hoje, não o de ontem.
CREATE TABLE relatorio_consumo (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orgao_id         UUID NOT NULL REFERENCES orgao(id),
  almoxarifado_id  UUID NOT NULL REFERENCES almoxarifado(id),
  -- Nulo = todos os tipos. A alimentação escolar costuma ser um tipo só, mas
  -- o mesmo relatório serve a material de expediente.
  tipo_estoque_id  UUID REFERENCES tipo_estoque(id),
  periodo_inicio   DATE NOT NULL,
  periodo_fim      DATE NOT NULL,
  criado_por       UUID REFERENCES usuario(id),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Período invertido devolveria relatório vazio, e o usuário concluiria que
  -- não houve movimento — o pior jeito de errar num relatório.
  CHECK (periodo_fim >= periodo_inicio)
);

CREATE INDEX idx_relatorio_consumo_orgao
  ON relatorio_consumo(orgao_id, criado_em DESC);

-- ---------------------------------------------------------------------------
-- O escopo novo no motor de documentos

ALTER TABLE documento_modelo DROP CONSTRAINT IF EXISTS documento_modelo_escopo_check;
ALTER TABLE documento_modelo
  ADD CONSTRAINT documento_modelo_escopo_check
  CHECK (escopo IN (
    'PROCESSO', 'PROCESSO_CONTRATO', 'ORDEM_FORNECIMENTO', 'SOLICITACAO',
    'BEM', 'TRANSFERENCIA_BEM', 'BAIXA_BEM', 'INVENTARIO',
    'VIAGEM', 'MANUTENCAO',
    'SOLICITACAO_ESTOQUE', 'ENTRADA_ESTOQUE', 'RELATORIO_CONSUMO'
  ));

INSERT INTO documento_modelo (orgao_id, modulo, escopo, tipo, nome, titulo, corpo)
VALUES
(NULL, 'ALMOXARIFADO', 'RELATORIO_CONSUMO', 'RELATORIO_CONSUMO',
 'Relatório de consumo', 'RELATÓRIO DE CONSUMO — ALIMENTAÇÃO ESCOLAR',
$corpo$<table>
<tbody>
<tr><th style="width: 25%">Almoxarifado</th><td>{{relatorio.almoxarifado}}</td></tr>
<tr><th>Tipo de estoque</th><td>{{relatorio.tipoEstoque}}</td></tr>
<tr><th>Período</th><td>{{relatorio.periodoInicio}} a {{relatorio.periodoFim}}</td></tr>
</tbody>
</table>
<h3>1. MOVIMENTO POR UNIDADE</h3>
<table>
<thead>
<tr><th>UNIDADE</th><th>CNPJ</th><th>RECEBIDO</th><th>CONSUMIDO</th><th>PERDIDO</th><th>DEVOLVIDO</th><th>SALDO</th></tr>
</thead>
<tbody>
{{#unidades}}<tr><td>{{nome}}</td><td>{{cnpj}}</td><td>{{recebido}}</td><td>{{consumido}}</td><td>{{perdido}}</td><td>{{devolvido}}</td><td>{{saldo}}</td></tr>{{/unidades}}
</tbody>
</table>
<h3>2. MOVIMENTO POR PRODUTO</h3>
<table>
<thead>
<tr><th>PRODUTO</th><th>UNID.</th><th>RECEBIDO</th><th>CONSUMIDO</th><th>PERDIDO</th><th>DEVOLVIDO</th></tr>
</thead>
<tbody>
{{#produtos}}<tr><td>{{nome}}</td><td>{{unidadeMedida}}</td><td>{{recebido}}</td><td>{{consumido}}</td><td>{{perdido}}</td><td>{{devolvido}}</td></tr>{{/produtos}}
</tbody>
</table>
<h3>3. AGRICULTURA FAMILIAR</h3>
<p>Do que entrou no almoxarifado neste período, {{relatorio.agriculturaFamiliarPercentual}}
veio de fornecedor cadastrado como agricultura familiar
({{relatorio.entradasAgriculturaFamiliar}} de {{relatorio.entradasTotal}} remessas).</p>
<p><small>O percentual é por número de remessas, não por valor: o almoxarifado
registra quantidade e não guarda preço. Para o percentual financeiro que o FNDE
cobra, use o valor das notas fiscais correspondentes.</small></p>
<h3>4. ASSINATURA</h3>
<p style="text-align: center">{{orgao.municipio}} – {{orgao.uf}}, {{data.curta}}</p>
<table>
<tbody>
<tr>
<td style="width: 50%; text-align: center">_______________________________<br>4.1. RESPONSÁVEL PELO ALMOXARIFADO</td>
<td style="width: 50%; text-align: center">_______________________________<br>4.2. NUTRICIONISTA (RT)</td>
</tr>
</tbody>
</table>
<p><small>Emitido por {{autor.nome}} — {{autor.cargo}}. Documento nº {{documento.codigo}}.</small></p>$corpo$)

ON CONFLICT DO NOTHING;
