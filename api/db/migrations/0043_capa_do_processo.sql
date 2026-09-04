-- 0043 — Capa do processo administrativo, decalcada da folha de Monção/MA.
--
-- É a primeira folha do processo físico: quem abre a pasta vê protocolo,
-- número, data, valor, de quem se compra e do que se trata, sem folhear.
--
-- Três coisas da folha original **não** entram aqui, e cada uma por um motivo:
--
-- 1. **O cabeçalho da entidade** — brasão, "ESTADO DO MARANHÃO", CNPJ e
--    endereço. O timbre do sistema já imprime isso em toda peça emitida;
--    repetir no corpo daria dois cabeçalhos na mesma folha.
--
-- 2. **O código de barras.** O sistema autentica por QR code, que o rodapé já
--    traz com o código de conferência. Duas marcas de leitura óptica na mesma
--    página, apontando para coisas diferentes, é convite a bipar a errada.
--
-- 3. **Banco, agência e conta do fornecedor.** Não existem no cadastro, e
--    inventar três colunas para preencher uma linha da capa seria criar campo
--    que ninguém mantém — o problema que este projeto já teve quatro vezes.
--
-- O quadro de movimentação financeira fica, com o valor bruto vindo do
-- contrato. Dedução e líquido saem em branco de propósito: variam por
-- pagamento, e o documento nasce como rascunho editável — quem emite preenche
-- antes de assinar. Melhor um campo em branco que quem emite completa do que um
-- número que o sistema chutou.
--
-- Escopo `PROCESSO_CONTRATO`: é o único que reúne, de uma vez, o processo, o
-- contrato que ele gerou e o fornecedor contratado. Processo sem contrato ainda
-- não tem capa para emitir — não há fornecedor nem valor a imprimir.
--
-- ---------------------------------------------------------------------------
-- POR QUE A CAPA NÃO É UMA GRADE DE TABELAS
--
-- A primeira versão decalcava a folha de Monção literalmente: quatro tabelas
-- empilhadas, rótulo à esquerda e valor à direita, 22 células. Os clientes
-- disseram que estava desagradável de olhar, e estavam certos — numa grade
-- tudo tem o mesmo peso, e a capa existe justamente para dizer, de longe, três
-- coisas: **qual processo é**, **do que se trata** e **quanto custa**.
--
-- A capa nova é uma folha de rosto, não um formulário:
--
--   * o número do processo em corpo 34, centralizado, é a primeira coisa que
--     se lê ao abrir a pasta — é por ele que o processo é procurado;
--   * o objeto vem centralizado logo abaixo, em corpo maior que o texto
--     corrido, porque é a resposta para "que processo é este?";
--   * o valor fica numa moldura própria, com o extenso embaixo — é o número
--     que o Tribunal procura primeiro;
--   * contratada, origem e unidade gestora viram blocos rotulados, com o
--     rótulo pequeno acima e o dado em destaque, em vez de linha de tabela.
--
-- Sobrou **uma** tabela, a da movimentação financeira, e ela fica: são três
-- números em coluna que se somam. Tabela onde há conta é ajuda; tabela onde há
-- rótulo e valor é ruído.
--
-- Sem cor, de propósito: o sanitizador não permite `color` (nem deveria — a
-- peça é preto no branco, impressa em impressora de repartição). A hierarquia
-- sai de tamanho, peso, moldura e espaço em branco, que sobrevivem à
-- fotocópia.

INSERT INTO documento_modelo (orgao_id, modulo, escopo, tipo, nome, titulo, corpo)
VALUES

(NULL, 'PROCESSOS', 'PROCESSO_CONTRATO', 'CAPA_PROCESSO',
 'Capa do processo administrativo', 'PROCESSO ADMINISTRATIVO',
$corpo$<p style="text-align: center; font-size: 34pt; font-weight: bold; margin: 10px 0 4px">{{processo.numeroProcessoAdm}}</p>

<p style="text-align: center; margin: 0 0 18px"><small>Protocolo {{processo.numeroProtocolo}} &middot; autuado em {{processo.dataAbertura}} &middot; {{processo.tipo}}</small></p>

<hr />

<p style="text-align: center; margin: 20px 0 4px"><small>OBJETO</small></p>

<p style="text-align: center; font-size: 15pt; margin: 0 0 6px">{{contrato.objeto}}</p>

<p style="text-align: center; margin: 0 0 24px"><small>{{processo.descricaoPedido}}</small></p>

<div style="border: 1px solid #999999; padding: 12px; margin: 0 0 22px">
<p style="text-align: center; margin: 0 0 2px"><small>VALOR DO PROCESSO</small></p>
<p style="text-align: center; font-size: 22pt; font-weight: bold; margin: 0 0 2px">R$ {{contrato.valorTotal}}</p>
<p style="text-align: center; margin: 0"><small>{{contrato.valorTotalPorExtenso}}</small></p>
</div>

<p style="text-align: left; margin: 0 0 2px"><small>CONTRATADA</small></p>
<p style="text-align: left; font-size: 13pt; font-weight: bold; margin: 0 0 2px">{{fornecedor.razaoSocial}}</p>
<p style="text-align: left; margin: 0 0 18px"><small>CNPJ/CPF {{fornecedor.documento}} &middot; {{fornecedor.endereco}} &middot; {{fornecedor.email}} &middot; {{fornecedor.telefone}}</small></p>

<p style="text-align: left; margin: 0 0 2px"><small>ORIGEM</small></p>
<p style="text-align: left; margin: 0 0 18px">{{contrato.modalidade}} nº {{contrato.origemNumero}} ({{contrato.origem}})<br />
Contrato nº <strong>{{contrato.numero}}</strong>, vigente de {{contrato.dataInicio}} a {{contrato.dataFim}}</p>

<p style="text-align: left; margin: 0 0 2px"><small>UNIDADE GESTORA</small></p>
<p style="text-align: left; margin: 0 0 4px">{{processo.unidadeSolicitante}}</p>
<p style="text-align: left; margin: 0 0 26px"><small>Fiscal do contrato: {{contrato.fiscal}}</small></p>

<hr />

<p style="text-align: left; margin: 18px 0 6px"><small>MOVIMENTAÇÃO FINANCEIRA</small></p>
<table style="width: 100%; border-collapse: collapse">
<tbody>
<tr><td style="width: 70%; padding: 4px">Valor bruto (a)</td><td style="text-align: right; padding: 4px">R$ {{contrato.valorTotal}}</td></tr>
<tr><td style="padding: 4px">Total das deduções (b)</td><td style="padding: 4px"></td></tr>
<tr><td style="padding: 4px"><strong>Total líquido (a &minus; b)</strong></td><td style="padding: 4px"></td></tr>
</tbody>
</table>

<p style="text-align: left; margin: 30px 0 0"><small>{{orgao.municipio}}, {{data.porExtenso}}.</small></p>$corpo$);
