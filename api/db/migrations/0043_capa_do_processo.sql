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

INSERT INTO documento_modelo (orgao_id, modulo, escopo, tipo, nome, titulo, corpo)
VALUES

(NULL, 'PROCESSOS', 'PROCESSO_CONTRATO', 'CAPA_PROCESSO',
 'Capa do processo administrativo', 'PROCESSO ADMINISTRATIVO',
$corpo$<table>
<tbody>
<tr>
<th style="width: 25%">Protocolo</th>
<td style="width: 25%">{{processo.numeroProtocolo}}</td>
<th style="width: 25%">Processo administrativo</th>
<td style="width: 25%">{{processo.numeroProcessoAdm}}</td>
</tr>
<tr>
<th>Data de abertura</th>
<td>{{processo.dataAbertura}}</td>
<th>Valor do processo</th>
<td><strong>R$ {{contrato.valorTotal}}</strong></td>
</tr>
</tbody>
</table>
<h3>FORNECEDOR</h3>
<table>
<tbody>
<tr><th style="width: 25%">Razão social</th><td colspan="3">{{fornecedor.razaoSocial}}</td></tr>
<tr>
<th>CNPJ/CPF</th><td style="width: 25%">{{fornecedor.documento}}</td>
<th style="width: 25%">E-mail</th><td>{{fornecedor.email}}</td>
</tr>
<tr><th>Endereço</th><td colspan="3">{{fornecedor.endereco}}</td></tr>
</tbody>
</table>
<h3>OBJETO</h3>
<table>
<tbody>
<tr>
<th style="width: 25%">Modalidade</th><td style="width: 25%">{{contrato.modalidade}}</td>
<th style="width: 25%">{{contrato.origem}} nº</th><td>{{contrato.origemNumero}}</td>
</tr>
<tr><th>Contrato nº</th><td colspan="3">{{contrato.numero}}</td></tr>
<tr><th>Descriminação do objeto</th><td colspan="3">{{contrato.objeto}}</td></tr>
<tr><th>Descriminação do processo</th><td colspan="3">{{processo.descricaoPedido}}</td></tr>
<tr><th>Unidade gestora</th><td colspan="3">{{processo.unidadeSolicitante}}</td></tr>
</tbody>
</table>
<h3>MOVIMENTAÇÃO FINANCEIRA</h3>
<table>
<tbody>
<tr><th style="width: 50%">Descrição</th><th>Valor</th></tr>
<tr><td>Valor bruto (a)</td><td>R$ {{contrato.valorTotal}}</td></tr>
<tr><td>Total das deduções (b)</td><td></td></tr>
<tr><td><strong>Total líquido (a − b)</strong></td><td></td></tr>
</tbody>
</table>
<p><small>Valor por extenso: {{contrato.valorTotalPorExtenso}}</small></p>$corpo$);
