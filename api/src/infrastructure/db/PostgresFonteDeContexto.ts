import { SEM_TRAVA } from "../../application/almoxarifado/ResolverAlcance";
import { pool } from "./pool";
import { valorPorExtenso } from "../../domain/documento/PorExtenso";
import { nomeDaModalidade } from "../../domain/licitacao/Modalidades";
import { percentualDeAgriculturaFamiliar } from "../../application/almoxarifado/ApurarConsumo";
import { PostgresRelatorioConsumoRepository } from "./PostgresRelatorioConsumoRepository";
import type { FonteDeContexto } from "../../application/documento/EmitirDocumento";
import type { ContextoDeDocumento } from "../../domain/documento/Marcadores";

/**
 * Junta os dados que o modelo pode interpolar.
 *
 * O `referenciaId` muda de significado conforme o tipo: peça de tramitação
 * aponta para o processo, ordem de fornecimento aponta para a própria ordem.
 * Quem chama a rota já sabe disso; aqui só se traduz para o contexto.
 */

const ORGAO = `
  SELECT o.nome, o.cnpj, o.municipio, o.uf, coalesce(o.endereco, '') AS endereco
    FROM orgao o WHERE o.id = $1`;

const PROCESSO = `
  SELECT p.numero_protocolo AS "numeroProtocolo",
         p.numero_processo_adm AS "numeroProcessoAdm",
         p.tipo_processo AS "tipo", p.status,
         to_char(p.data_abertura AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS "dataAbertura",
         coalesce(s.nome, '—') AS "setorAtual",
         coalesce(u.nome, '—') AS "unidadeSolicitante",
         coalesce(nullif(btrim(p.descricao_pedido), ''), '—') AS "descricaoPedido"
    FROM processo p
    LEFT JOIN setor s ON s.id = p.setor_atual_id
    LEFT JOIN solicitacao sol ON sol.processo_id = p.id
    LEFT JOIN unidade u ON u.id = sol.unidade_solicitante_id
   WHERE p.orgao_id = $1 AND p.id = $2`;

/** Contrato ligado ao processo pela solicitação — o caminho que o modelo usa. */
const CONTRATO_DO_PROCESSO = `
  SELECT DISTINCT ON (c.id)
         c.numero, coalesce(a.objeto, l.objeto, '') AS objeto,
         to_char(c.data_inicio, 'DD/MM/YYYY') AS "dataInicio",
         coalesce(to_char(c.data_fim, 'DD/MM/YYYY'), 'sem termo') AS "dataFim",
         c.valor_total AS "valorTotal",
         coalesce(c.fiscal_nome_matricula, '—') AS fiscal,
         CASE WHEN c.ata_id IS NOT NULL THEN 'Ata' ELSE 'Licitação' END AS origem,
         coalesce(a.numero, l.numero, '—') AS "origemNumero",
         f.razao_social AS "fornecedorRazaoSocial", f.documento AS "fornecedorDocumento",
         coalesce(f.endereco, '') AS "fornecedorEndereco",
         coalesce(f.email, '') AS "fornecedorEmail",
         coalesce(f.telefone, '') AS "fornecedorTelefone",
         coalesce(f.inscricao_estadual, '') AS "fornecedorInscricaoEstadual",
         coalesce(f.inscricao_municipal, '') AS "fornecedorInscricaoMunicipal",
         coalesce(l.modalidade, la.modalidade, '') AS modalidade
    FROM contrato c
    JOIN fornecedor f ON f.id = c.fornecedor_id
    LEFT JOIN ata_registro_precos a ON a.id = c.ata_id
    LEFT JOIN licitacao l ON l.id = c.licitacao_id
    -- A licitação que gerou a ata: contrato por ata herda a modalidade dela.
    LEFT JOIN licitacao la ON la.id = a.licitacao_id
    JOIN item i ON i.contrato_id = c.id
    JOIN solicitacao_item si ON si.item_id = i.id
    JOIN solicitacao s ON s.id = si.solicitacao_id
   WHERE c.orgao_id = $1 AND s.processo_id = $2
   ORDER BY c.id
   LIMIT 1`;

const ORDEM = `
  SELECT o.numero, coalesce(o.numero_empenho, '') AS "numeroEmpenho",
         coalesce(o.numero_requisicao, '') AS "numeroRequisicao",
         coalesce(o.projeto_atividade, '') AS "projetoAtividade",
         coalesce(o.elemento_despesa, '') AS "elementoDespesa",
         coalesce(o.fonte_recurso, '') AS "fonteRecurso",
         coalesce(o.numero_parcelas, 1) AS "numeroParcelas",
         coalesce(o.numero_nota_fiscal, '') AS "numeroNotaFiscal",
         o.valor, o.processo_id AS "processoId", o.contrato_id AS "contratoId",
         o.dados_contratante AS "dadosContratante"
    FROM ordem_fornecimento o
   WHERE o.orgao_id = $1 AND o.id = $2`;

const CONTRATO_POR_ID = `
  SELECT c.numero, coalesce(a.objeto, l.objeto, '') AS objeto,
         to_char(c.data_inicio, 'DD/MM/YYYY') AS "dataInicio",
         coalesce(to_char(c.data_fim, 'DD/MM/YYYY'), 'sem termo') AS "dataFim",
         c.valor_total AS "valorTotal",
         coalesce(c.fiscal_nome_matricula, '—') AS fiscal,
         CASE WHEN c.ata_id IS NOT NULL THEN 'Ata' ELSE 'Licitação' END AS origem,
         coalesce(a.numero, l.numero, '—') AS "origemNumero",
         f.razao_social AS "fornecedorRazaoSocial", f.documento AS "fornecedorDocumento",
         coalesce(f.endereco, '') AS "fornecedorEndereco",
         coalesce(f.email, '') AS "fornecedorEmail",
         coalesce(f.telefone, '') AS "fornecedorTelefone",
         coalesce(f.inscricao_estadual, '') AS "fornecedorInscricaoEstadual",
         coalesce(f.inscricao_municipal, '') AS "fornecedorInscricaoMunicipal",
         coalesce(l.modalidade, la.modalidade, '') AS modalidade
    FROM contrato c
    JOIN fornecedor f ON f.id = c.fornecedor_id
    LEFT JOIN ata_registro_precos a ON a.id = c.ata_id
    LEFT JOIN licitacao l ON l.id = c.licitacao_id
    LEFT JOIN licitacao la ON la.id = a.licitacao_id
   WHERE c.orgao_id = $1 AND c.id = $2`;

/** Itens da solicitação do processo — o que a ordem manda entregar. */
const ITENS_DO_PROCESSO = `
  SELECT i.produto, coalesce(i.descricao, '') AS descricao,
         i.unidade_medida AS "unidadeMedida", coalesce(i.marca, '') AS marca,
         si.quantidade_solicitada AS quantidade,
         i.valor_unitario AS "valorUnitario",
         si.valor_calculado AS "valorTotal"
    FROM solicitacao_item si
    JOIN item i ON i.id = si.item_id
    JOIN solicitacao s ON s.id = si.solicitacao_id
   WHERE s.processo_id = $1
   ORDER BY i.produto`;

const SOLICITACAO = `
  SELECT s.situacao, s.processo_id AS "processoId",
         to_char(s.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS "criadaEm",
         coalesce((SELECT sum(si.valor_calculado) FROM solicitacao_item si
                    WHERE si.solicitacao_id = s.id), 0) AS "valorTotal"
    FROM solicitacao s
   WHERE s.orgao_id = $1 AND s.id = $2`;

const ITENS_DA_SOLICITACAO = `
  SELECT i.produto, coalesce(i.descricao, '') AS descricao,
         i.unidade_medida AS "unidadeMedida", coalesce(i.marca, '') AS marca,
         si.quantidade_solicitada AS quantidade,
         i.valor_unitario AS "valorUnitario",
         si.valor_calculado AS "valorTotal"
    FROM solicitacao_item si
    JOIN item i ON i.id = si.item_id
   WHERE si.solicitacao_id = $1
   ORDER BY i.produto`;

const PARECER = `
  SELECT d.tipo, coalesce(d.texto, '') AS texto,
         coalesce(s.nome, '—') AS "setorDestino"
    FROM despacho d
    LEFT JOIN setor s ON s.id = d.setor_id
   WHERE d.processo_id = $1
   ORDER BY d.data DESC
   LIMIT 1`;

// ---------------------------------------------------------------------------
// Patrimônio
//
// `transferencia_bem`, `baixa_bem`, `inventario` e `inventario_item` não têm
// `orgao_id` próprio — alcançam o órgão por join no bem ou no local. Filtrar
// só pelo id da linha aqui deixaria uma prefeitura emitir termo sobre o
// patrimônio de outra, bastando conhecer o id.

const BEM = `
  SELECT b.codigo_tombamento AS tombamento, b.nome,
         cb.nome AS categoria,
         b.estado_conservacao AS "estadoConservacao", b.status,
         la.nome AS "localAtual", lt.nome AS "localTombamento",
         coalesce(to_char(r.data, 'DD/MM/YYYY'),
                  to_char(b.created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')) AS "dataEntrada",
         coalesce(r.nota_fiscal, '—') AS "notaFiscal",
         coalesce(f.razao_social, '—') AS fornecedor
    FROM bem b
    JOIN categoria_bem cb ON cb.id = b.categoria_id
    JOIN local la ON la.id = b.local_atual_id
    JOIN local lt ON lt.id = b.local_tombamento_id
    LEFT JOIN remessa_lote rl ON rl.id = b.remessa_lote_id
    LEFT JOIN remessa_patrimonio r ON r.id = rl.remessa_id
    LEFT JOIN fornecedor f ON f.id = r.fornecedor_id
   WHERE b.orgao_id = $1 AND b.id = $2`;

const TRANSFERENCIA = `
  SELECT t.bem_id AS "bemId", t.status,
         lo.nome AS "localOrigem", ld.nome AS "localDestino",
         to_char(t.data_envio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS "dataEnvio",
         coalesce(
           to_char(t.data_aceite AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), '—'
         ) AS "dataAceite",
         ue.nome AS "enviadoPor", coalesce(ua.nome, '—') AS "aceitoPor"
    FROM transferencia_bem t
    JOIN bem b ON b.id = t.bem_id
    JOIN local lo ON lo.id = t.local_origem_id
    JOIN local ld ON ld.id = t.local_destino_id
    JOIN usuario ue ON ue.id = t.enviado_por_usuario_id
    LEFT JOIN usuario ua ON ua.id = t.aceito_por_usuario_id
   WHERE b.orgao_id = $1 AND t.id = $2`;

const BAIXA = `
  SELECT bx.motivo, coalesce(bx.observacao, '—') AS observacao,
         to_char(bx.data AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS data,
         u.nome AS responsavel
    FROM baixa_bem bx
    JOIN bem b ON b.id = bx.bem_id
    JOIN usuario u ON u.id = bx.usuario_id
   WHERE b.orgao_id = $1 AND bx.bem_id = $2`;

const INVENTARIO = `
  SELECT l.nome AS local, i.status,
         to_char(i.data_inicio, 'DD/MM/YYYY') AS "dataInicio",
         coalesce(to_char(i.data_conclusao, 'DD/MM/YYYY'), '—') AS "dataConclusao",
         (SELECT count(*) FROM inventario_item ii WHERE ii.inventario_id = i.id) AS "totalBens",
         (SELECT count(*) FROM inventario_item ii
           WHERE ii.inventario_id = i.id AND ii.situacao = 'ENCONTRADO') AS encontrados,
         (SELECT count(*) FROM inventario_item ii
           WHERE ii.inventario_id = i.id AND ii.situacao = 'NAO_ENCONTRADO') AS "naoEncontrados"
    FROM inventario i
    JOIN local l ON l.id = i.local_id
   WHERE l.orgao_id = $1 AND i.id = $2`;

const BENS_CONFERIDOS = `
  SELECT b.codigo_tombamento AS tombamento, b.nome, cb.nome AS categoria,
         ii.situacao, coalesce(ii.estado_observado, '—') AS "estadoObservado",
         coalesce(ii.observacao, '') AS observacao
    FROM inventario_item ii
    JOIN bem b ON b.id = ii.bem_id
    JOIN categoria_bem cb ON cb.id = b.categoria_id
   WHERE ii.inventario_id = $1
   ORDER BY b.codigo_tombamento`;

// ---------------------------------------------------------------------------
// Frotas
//
// `manutencao` alcança o órgão pelo veículo; `retirada`, `finalizacao` e
// `abastecimento` alcançam pela viagem.

const VEICULO_DA_VIAGEM = `
  SELECT ve.placa, ve.modelo, coalesce(ve.ano::text, '—') AS ano,
         coalesce(ve.tipo, '—') AS tipo,
         coalesce(un.nome, 'Frota central') AS unidade,
         ve.quilometragem_atual AS "quilometragemAtual"
    FROM veiculo ve
    LEFT JOIN unidade un ON un.id = ve.unidade_id
   WHERE ve.id = $1`;

const VIAGEM = `
  SELECT v.status, v.motivo, v.responsavel, v.veiculo_id AS "veiculoId",
         us.nome AS "unidadeSolicitante",
         to_char(v.data_hora_desejada AT TIME ZONE 'America/Sao_Paulo',
                 'DD/MM/YYYY HH24:MI') AS "dataHoraDesejada",
         coalesce(to_char(v.data_hora_remarcada AT TIME ZONE 'America/Sao_Paulo',
                          'DD/MM/YYYY HH24:MI'), '—') AS "dataHoraRemarcada",
         m.nome AS "motoristaNome", m.cnh AS "motoristaCnh",
         m.categoria_cnh AS "motoristaCategoriaCnh",
         to_char(m.validade_cnh, 'DD/MM/YYYY') AS "motoristaValidadeCnh",
         coalesce(to_char(r.data_hora AT TIME ZONE 'America/Sao_Paulo',
                          'DD/MM/YYYY HH24:MI'), '—') AS "retiradaDataHora",
         r.km_inicial AS "retiradaKmInicial",
         CASE
           WHEN r.nota_combustivel_tipo = 'LITRO'
             THEN to_char(r.nota_combustivel_quantidade, 'FM999G999D00') || ' L'
           WHEN r.nota_combustivel_tipo = 'VALOR'
             THEN 'R$ ' || to_char(r.nota_combustivel_quantidade, 'FM999G999D00')
           ELSE '—'
         END AS "retiradaNotaCombustivel",
         coalesce(to_char(fi.data_hora AT TIME ZONE 'America/Sao_Paulo',
                          'DD/MM/YYYY HH24:MI'), '—') AS "finalizacaoDataHora",
         fi.km_final AS "finalizacaoKmFinal",
         coalesce(fi.sinistro, '—') AS "finalizacaoSinistro",
         (SELECT coalesce(sum(a.litros), 0) FROM abastecimento a
           WHERE a.viagem_id = v.id) AS "totalLitros",
         (SELECT coalesce(sum(a.valor), 0) FROM abastecimento a
           WHERE a.viagem_id = v.id) AS "totalCombustivel"
    FROM viagem v
    JOIN unidade us ON us.id = v.unidade_solicitante_id
    JOIN motorista m ON m.id = v.motorista_id
    LEFT JOIN retirada r ON r.viagem_id = v.id
    LEFT JOIN finalizacao fi ON fi.viagem_id = v.id
   WHERE v.orgao_id = $1 AND v.id = $2`;

const ABASTECIMENTOS = `
  SELECT to_char(a.data AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS data,
         a.litros, a.valor
    FROM abastecimento a
   WHERE a.viagem_id = $1
   ORDER BY a.data`;

// ---------------------------------------------------------------------------
// Almoxarifado
//
// `solicitacao_estoque` e `liberacao_lote` alcançam o órgão pelo local; a
// remessa, pelo almoxarifado.

const PEDIDO_ESTOQUE = `
  SELECT l.nome AS local, coalesce(a.nome, '—') AS almoxarifado,
         coalesce(te.nome, '—') AS "tipoEstoque",
         u.nome AS autor, s.status,
         to_char(s.data AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS data,
         coalesce(to_char(s.enviada_em AT TIME ZONE 'America/Sao_Paulo',
                          'DD/MM/YYYY HH24:MI'), '—') AS "enviadoEm",
         coalesce(to_char(s.liberada_em AT TIME ZONE 'America/Sao_Paulo',
                          'DD/MM/YYYY HH24:MI'), '—') AS "liberadoEm",
         coalesce(to_char(s.recebida_em AT TIME ZONE 'America/Sao_Paulo',
                          'DD/MM/YYYY HH24:MI'), '—') AS "recebidoEm",
         coalesce(ul.nome, '—') AS "liberadoPor",
         coalesce(ur.nome, '—') AS "recebidoPor",
         coalesce(l.cnpj, '—') AS cnpj,
         coalesce(l.endereco, '—') AS endereco,
         coalesce(l.responsavel, '—') AS responsavel,
         (SELECT count(*) FROM solicitacao_estoque_item si
           WHERE si.solicitacao_id = s.id) AS "totalItens",
         (SELECT count(*) FROM liberacao_lote ll
            JOIN solicitacao_estoque_item si ON si.id = ll.solicitacao_item_id
           WHERE si.solicitacao_id = s.id) AS "totalLotes"
    FROM solicitacao_estoque s
    JOIN local l ON l.id = s.local_solicitante_id
    JOIN usuario u ON u.id = s.autor_usuario_id
    LEFT JOIN almoxarifado a ON a.id = l.almoxarifado_id
    LEFT JOIN tipo_estoque te ON te.id = s.tipo_estoque_id
    LEFT JOIN usuario ul ON ul.id = s.liberada_por_usuario_id
    LEFT JOIN usuario ur ON ur.id = s.recebida_por_usuario_id
   WHERE l.orgao_id = $1 AND s.id = $2`;

const ITENS_DO_PEDIDO = `
  SELECT p.nome AS produto, p.unidade_medida AS "unidadeMedida",
         si.quantidade_solicitada AS solicitado,
         si.quantidade_liberada AS liberado,
         si.quantidade_recebida AS recebido
    FROM solicitacao_estoque_item si
    JOIN produto p ON p.id = si.produto_id
   WHERE si.solicitacao_id = $1
   ORDER BY p.nome`;

// Por lote, e não por produto: o romaneio é conferido caixa por caixa, e caixa
// tem validade. Agrupar perderia o dado que se confere.
const LOTES_DO_PEDIDO = `
  SELECT p.nome AS produto, p.unidade_medida AS "unidadeMedida",
         r.codigo AS remessa, lo.data_validade AS validade,
         ll.quantidade, ll.quantidade_confirmada AS confirmado,
         ll.quantidade_perdida AS perdido,
         coalesce(ll.motivo_perda, '') AS "motivoPerda"
    FROM liberacao_lote ll
    JOIN solicitacao_estoque_item si ON si.id = ll.solicitacao_item_id
    JOIN produto p ON p.id = si.produto_id
    JOIN lote lo ON lo.id = ll.lote_id
    JOIN remessa_estoque r ON r.id = lo.remessa_id
   WHERE si.solicitacao_id = $1
   ORDER BY p.nome, lo.data_validade NULLS LAST`;

const ENTRADA_ESTOQUE = `
  SELECT r.codigo, r.titulo,
         to_char(r.data, 'DD/MM/YYYY') AS data,
         a.nome AS almoxarifado, te.nome AS "tipoEstoque",
         coalesce(r.local_armazenado, '—') AS "localArmazenado",
         coalesce(r.nota_fiscal, '—') AS "notaFiscal",
         coalesce(f.razao_social, '—') AS fornecedor,
         coalesce(u.nome, '—') AS responsavel,
         (SELECT count(*) FROM lote lo WHERE lo.remessa_id = r.id) AS "totalLotes"
    FROM remessa_estoque r
    JOIN almoxarifado a ON a.id = r.almoxarifado_id
    JOIN tipo_estoque te ON te.id = r.tipo_estoque_id
    LEFT JOIN fornecedor f ON f.id = r.fornecedor_id
    LEFT JOIN usuario u ON u.id = r.responsavel_usuario_id
   WHERE a.orgao_id = $1 AND r.id = $2`;

const LOTES_DA_ENTRADA = `
  SELECT p.nome AS produto, p.unidade_medida AS "unidadeMedida",
         lo.quantidade, lo.data_validade AS validade
    FROM lote lo
    JOIN produto p ON p.id = lo.produto_id
   WHERE lo.remessa_id = $1
   ORDER BY lo.data_validade NULLS LAST, p.nome`;

/**
 * Comprovante de devolução.
 *
 * A validade vem do lote da unidade, e não do produto: é aquela caixa que está
 * voltando, e o almoxarifado precisa saber quando ela vence para decidir se
 * ainda serve. O órgão é alcançado pelo local — devolução de outra prefeitura
 * não vira documento aqui.
 */
const DEVOLUCAO_ESTOQUE = `
  SELECT l.nome AS local, a.nome AS almoxarifado,
         p.nome AS produto, p.unidade_medida AS "unidadeMedida",
         d.quantidade,
         -- A validade é do lote que está na unidade, e não da devolução: é
         -- aquela caixa que está voltando.
         el.data_validade AS validade,
         coalesce(d.motivo, '—') AS motivo,
         to_char(d.data, 'DD/MM/YYYY') AS data,
         coalesce(us.nome, '—') AS "solicitadaPor",
         d.status AS situacao,
         coalesce(to_char(d.respondida_em, 'DD/MM/YYYY'), '—') AS "respondidaEm",
         coalesce(ua.nome, '—') AS "aceitaPor",
         coalesce(d.recusa_motivo, '—') AS "motivoRecusa"
    FROM devolucao d
    JOIN local l ON l.id = d.local_id
    JOIN almoxarifado a ON a.id = d.almoxarifado_id
    JOIN produto p ON p.id = d.produto_id
    LEFT JOIN estoque_local el ON el.id = d.estoque_local_id
    LEFT JOIN usuario us ON us.id = d.solicitada_por_usuario_id
    LEFT JOIN usuario ua ON ua.id = d.aceito_por_usuario_id
   WHERE l.orgao_id = $1 AND d.id = $2`;

/**
 * A declaração de conclusão do checklist.
 *
 * A situação de cada item é derivada do último ciclo, com a mesma regra do
 * domínio e do repositório — três cópias da mesma verdade, e um teste que as
 * amarra. Aqui ela precisa existir porque o documento congela o texto: o que
 * for escrito na peça é o que ela dirá para sempre.
 */
const CHECKLIST = `
  SELECT ck.titulo, coalesce(ck.descricao, '—') AS descricao,
         coalesce(ck.alvo_tipo, 'avulso') AS alvo,
         coalesce(s.nome, d.nome, '—') AS responsavel,
         coalesce(u.nome, '—') AS "criadoPor",
         to_char(ck.criado_em, 'DD/MM/YYYY') AS "criadoEm",
         (SELECT count(*) FROM checklist_item i WHERE i.checklist_id = ck.id)
           AS "totalItens",
         to_char(current_date, 'DD/MM/YYYY') AS "completoEm"
    FROM checklist ck
    LEFT JOIN setor s ON s.id = ck.setor_id
    LEFT JOIN departamento d ON d.id = ck.departamento_id
    LEFT JOIN usuario u ON u.id = ck.criado_por
   WHERE ck.orgao_id = $1 AND ck.id = $2`;

const ITENS_DO_CHECKLIST = `
  SELECT i.titulo, coalesce(i.descricao, '—') AS descricao,
         CASE
           WHEN i.dispensado_em IS NOT NULL THEN 'dispensado'
           WHEN c.id IS NULL THEN 'pendente'
           WHEN c.situacao = 'AGUARDANDO' THEN 'aguardando conferência'
           WHEN c.situacao = 'RECUSADO' THEN 'pendente'
           WHEN c.vigencia_ate IS NULL THEN 'cumprido'
           WHEN c.vigencia_ate >= current_date THEN 'cumprido'
           ELSE 'vencido'
         END AS situacao,
         coalesce(to_char(i.prazo_limite, 'DD/MM/YYYY'), '—') AS prazo,
         coalesce(to_char(c.cumprido_em, 'DD/MM/YYYY'), '—') AS "cumpridoEm",
         coalesce(uc.nome, CASE WHEN c.cumprido_por_externo THEN 'fornecedor' END, '—')
           AS "cumpridoPor",
         coalesce(uv.nome, '—') AS "conferidoPor",
         coalesce(to_char(c.vigencia_ate, 'DD/MM/YYYY'), 'sem prazo') AS "vigenciaAte",
         coalesce(c.observacao, '—') AS observacao
    FROM checklist_item i
    LEFT JOIN LATERAL (
      SELECT cc.* FROM checklist_item_cumprimento cc
       WHERE cc.item_id = i.id ORDER BY cc.ciclo DESC LIMIT 1
    ) c ON TRUE
    LEFT JOIN usuario uc ON uc.id = c.cumprido_por
    LEFT JOIN usuario uv ON uv.id = c.conferido_por
   WHERE i.checklist_id = $1
   ORDER BY i.ordem`;

const MANUTENCAO = `
  SELECT mn.tipo, coalesce(mn.descricao, '—') AS descricao,
         coalesce(mn.oficina, '—') AS oficina,
         to_char(mn.data_inicio, 'DD/MM/YYYY') AS "dataInicio",
         coalesce(to_char(mn.data_fim, 'DD/MM/YYYY'), '—') AS "dataFim",
         CASE WHEN mn.data_fim IS NULL THEN 'Em andamento' ELSE 'Encerrada' END AS status,
         mn.custo, mn.veiculo_id AS "veiculoId"
    FROM manutencao mn
    JOIN veiculo ve ON ve.id = mn.veiculo_id
   WHERE ve.orgao_id = $1 AND mn.id = $2`;

const dinheiro = (valor: unknown) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(Number(valor ?? 0));

const numero = (valor: unknown) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(Number(valor ?? 0));

/** Item no formato que o modelo consome, com números já formatados. */
const itemParaContexto = (linha: Record<string, unknown>) => ({
  produto: String(linha.produto ?? ""),
  descricao: String(linha.descricao ?? ""),
  unidadeMedida: String(linha.unidadeMedida ?? ""),
  marca: String(linha.marca ?? ""),
  quantidade: numero(linha.quantidade),
  valorUnitario: dinheiro(linha.valorUnitario),
  valorTotal: dinheiro(linha.valorTotal),
});


const contratoParaContexto = (linha: Record<string, unknown>) => ({
  contrato: {
    modalidade: nomeDaModalidade(String(linha.modalidade ?? "")),
    numero: String(linha.numero ?? ""),
    objeto: String(linha.objeto ?? ""),
    dataInicio: String(linha.dataInicio ?? ""),
    dataFim: String(linha.dataFim ?? "—"),
    valorTotal: dinheiro(linha.valorTotal),
    valorTotalPorExtenso: valorPorExtenso(Number(linha.valorTotal ?? 0)),
    fiscal: String(linha.fiscal ?? ""),
    origem: String(linha.origem ?? ""),
    origemNumero: String(linha.origemNumero ?? ""),
  },
  fornecedor: {
    razaoSocial: String(linha.fornecedorRazaoSocial ?? ""),
    documento: mascararDocumento(String(linha.fornecedorDocumento ?? "")),
    endereco: String(linha.fornecedorEndereco ?? ""),
    email: String(linha.fornecedorEmail ?? ""),
    telefone: String(linha.fornecedorTelefone ?? ""),
    inscricaoEstadual: String(linha.fornecedorInscricaoEstadual ?? ""),
    inscricaoMunicipal: String(linha.fornecedorInscricaoMunicipal ?? ""),
  },
});

export class PostgresFonteDeContexto implements FonteDeContexto {
  // A apuração do relatório é a mesma que a tela mostra: se a peça a
  // recalculasse por outro caminho, o papel e a tela poderiam divergir.
  private readonly relatorios = new PostgresRelatorioConsumoRepository();

  /**
   * O escopo do modelo decide o que buscar e o que o `referenciaId` significa.
   * Antes isso era decidido pelo `tipo`, o que impedia peça nova sem código.
   */
  montar = async (
    orgaoId: string,
    escopo: string,
    referenciaId: string,
  ): Promise<ContextoDeDocumento | null> => {
    const linhaDoOrgao = (await pool.query(ORGAO, [orgaoId])).rows[0];
    if (!linhaDoOrgao) return null;

    // O CNPJ é gravado só com dígitos. Na peça impressa ele é lido por quem vai
    // comparar com a nota fiscal, e ninguém confere "06190243000116".
    const orgao = {
      ...linhaDoOrgao,
      cnpj: mascararDocumento(String(linhaDoOrgao.cnpj ?? "")),
    };

    if (escopo === "PROCESSO" || escopo === "PROCESSO_CONTRATO") {
      return this.doProcesso(orgaoId, escopo, referenciaId, orgao);
    }
    if (escopo === "ORDEM_FORNECIMENTO") return this.daOrdem(orgaoId, referenciaId, orgao);
    if (escopo === "SOLICITACAO") return this.daSolicitacao(orgaoId, referenciaId, orgao);
    if (escopo === "BEM") return this.doBem(orgaoId, referenciaId, orgao);
    if (escopo === "TRANSFERENCIA_BEM") return this.daTransferencia(orgaoId, referenciaId, orgao);
    if (escopo === "BAIXA_BEM") return this.daBaixa(orgaoId, referenciaId, orgao);
    if (escopo === "INVENTARIO") return this.doInventario(orgaoId, referenciaId, orgao);
    if (escopo === "VIAGEM") return this.daViagem(orgaoId, referenciaId, orgao);
    if (escopo === "MANUTENCAO") return this.daManutencao(orgaoId, referenciaId, orgao);
    if (escopo === "SOLICITACAO_ESTOQUE") return this.doPedido(orgaoId, referenciaId, orgao);
    if (escopo === "ENTRADA_ESTOQUE") return this.daEntrada(orgaoId, referenciaId, orgao);
    if (escopo === "DEVOLUCAO_ESTOQUE") {
      return this.daDevolucao(orgaoId, referenciaId, orgao);
    }
    if (escopo === "RELATORIO_CONSUMO") return this.doRelatorio(orgaoId, referenciaId, orgao);
    if (escopo === "CHECKLIST") return this.doChecklist(orgaoId, referenciaId, orgao);
    return null;
  };

  private doProcesso = async (
    orgaoId: string,
    escopo: string,
    processoId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const processo = (await pool.query(PROCESSO, [orgaoId, processoId])).rows[0];
    if (!processo) return null;

    // Último despacho: serve de texto ao despacho e de justificativa ao
    // parecer. Vem sempre, porque qualquer peça de trâmite pode citá-lo.
    const ultimo = (await pool.query(PARECER, [processoId])).rows[0];
    const contexto: ContextoDeDocumento = {
      orgao,
      processo,
      despacho: {
        texto: String(ultimo?.texto ?? ""),
        setorDestino: String(ultimo?.setorDestino ?? "—"),
      },
      parecer: {
        favoravel: ultimo?.tipo === "PARECER" ? "favorável" : "—",
        justificativa: String(ultimo?.texto ?? ""),
      },
    };

    if (escopo === "PROCESSO_CONTRATO") {
      const contrato = (await pool.query(CONTRATO_DO_PROCESSO, [orgaoId, processoId])).rows[0];
      // Sem contrato ligado, os marcadores viriam vazios e o documento sairia
      // afirmando coisa sobre um contrato que não existe.
      if (!contrato) return null;
      Object.assign(contexto, contratoParaContexto(contrato));
    }

    return contexto;
  };

  private daOrdem = async (
    orgaoId: string,
    ordemId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const ordem = (await pool.query(ORDEM, [orgaoId, ordemId])).rows[0];
    if (!ordem) return null;

    const [processo, contrato, itens] = await Promise.all([
      pool.query(PROCESSO, [orgaoId, ordem.processoId]),
      pool.query(CONTRATO_POR_ID, [orgaoId, ordem.contratoId]),
      pool.query(ITENS_DO_PROCESSO, [ordem.processoId]),
    ]);
    if (!processo.rows[0] || !contrato.rows[0]) return null;

    return {
      orgao,
      processo: processo.rows[0],
      ...contratoParaContexto(contrato.rows[0]),
      // Quem contrata. `dados_contratante` era gravado e nunca lido; sem ele
      // informado, cai no órgão — a peça sai correta em vez de sair com lacuna.
      contratante: contratanteParaContexto(ordem.dadosContratante, orgao),
      ordem: {
        numero: String(ordem.numero),
        numeroEmpenho: String(ordem.numeroEmpenho),
        numeroRequisicao: String(ordem.numeroRequisicao),
        projetoAtividade: String(ordem.projetoAtividade),
        elementoDespesa: String(ordem.elementoDespesa),
        fonteRecurso: String(ordem.fonteRecurso),
        numeroParcelas: String(ordem.numeroParcelas),
        numeroNotaFiscal: String(ordem.numeroNotaFiscal),
        valor: dinheiro(ordem.valor),
        valorPorExtenso: valorPorExtenso(Number(ordem.valor)),
      },
      itens: itens.rows.map(itemParaContexto),
    };
  };

  private daSolicitacao = async (
    orgaoId: string,
    solicitacaoId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const solicitacao = (await pool.query(SOLICITACAO, [orgaoId, solicitacaoId])).rows[0];
    if (!solicitacao) return null;

    const itens = await pool.query(ITENS_DA_SOLICITACAO, [solicitacaoId]);
    // Rascunho ainda não tem processo; os marcadores vêm com traço em vez de
    // vazio, para a peça não sair com lacuna muda.
    const processo = solicitacao.processoId
      ? (await pool.query(PROCESSO, [orgaoId, solicitacao.processoId])).rows[0]
      : null;

    return {
      orgao,
      processo: processo ?? {
        numeroProtocolo: "—", numeroProcessoAdm: "—", tipo: "—", status: "RASCUNHO",
        dataAbertura: "—", setorAtual: "—", unidadeSolicitante: "—",
        descricaoPedido: "—",
      },
      solicitacao: {
        situacao: String(solicitacao.situacao),
        criadaEm: String(solicitacao.criadaEm),
        valorTotal: dinheiro(solicitacao.valorTotal),
        valorTotalPorExtenso: valorPorExtenso(Number(solicitacao.valorTotal)),
      },
      itens: itens.rows.map(itemParaContexto),
    };
  };

  // ---- Patrimônio ---------------------------------------------------------

  private doBem = async (
    orgaoId: string,
    bemId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const bem = (await pool.query(BEM, [orgaoId, bemId])).rows[0];
    return bem ? { orgao, bem: bemParaContexto(bem) } : null;
  };

  private daTransferencia = async (
    orgaoId: string,
    transferenciaId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const transferencia = (await pool.query(TRANSFERENCIA, [orgaoId, transferenciaId])).rows[0];
    if (!transferencia) return null;

    const bem = (await pool.query(BEM, [orgaoId, transferencia.bemId])).rows[0];
    if (!bem) return null;

    return {
      orgao,
      bem: bemParaContexto(bem),
      transferencia: {
        localOrigem: String(transferencia.localOrigem),
        localDestino: String(transferencia.localDestino),
        status: String(transferencia.status),
        dataEnvio: String(transferencia.dataEnvio),
        dataAceite: String(transferencia.dataAceite),
        enviadoPor: String(transferencia.enviadoPor),
        aceitoPor: String(transferencia.aceitoPor),
      },
    };
  };

  private daBaixa = async (
    orgaoId: string,
    bemId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const baixa = (await pool.query(BAIXA, [orgaoId, bemId])).rows[0];
    // Sem baixa registrada os marcadores viriam vazios e o termo sairia
    // afirmando uma baixa que não aconteceu.
    if (!baixa) return null;

    const bem = (await pool.query(BEM, [orgaoId, bemId])).rows[0];
    if (!bem) return null;

    return {
      orgao,
      bem: bemParaContexto(bem),
      baixa: {
        motivo: MOTIVO_DA_BAIXA[String(baixa.motivo)] ?? String(baixa.motivo),
        observacao: String(baixa.observacao),
        data: String(baixa.data),
        responsavel: String(baixa.responsavel),
      },
    };
  };

  private doInventario = async (
    orgaoId: string,
    inventarioId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const inventario = (await pool.query(INVENTARIO, [orgaoId, inventarioId])).rows[0];
    if (!inventario) return null;

    const bens = await pool.query(BENS_CONFERIDOS, [inventarioId]);
    return {
      orgao,
      inventario: {
        local: String(inventario.local),
        status: String(inventario.status),
        dataInicio: String(inventario.dataInicio),
        dataConclusao: String(inventario.dataConclusao),
        totalBens: String(inventario.totalBens),
        encontrados: String(inventario.encontrados),
        naoEncontrados: String(inventario.naoEncontrados),
      },
      bens: bens.rows.map((linha) => ({
        tombamento: String(linha.tombamento),
        nome: String(linha.nome),
        categoria: String(linha.categoria),
        situacao: linha.situacao === "ENCONTRADO" ? "Encontrado" : "Não encontrado",
        estadoObservado: String(linha.estadoObservado),
        observacao: String(linha.observacao),
      })),
    };
  };

  // ---- Frotas -------------------------------------------------------------

  private daViagem = async (
    orgaoId: string,
    viagemId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const viagem = (await pool.query(VIAGEM, [orgaoId, viagemId])).rows[0];
    if (!viagem) return null;

    const [veiculo, abastecimentos] = await Promise.all([
      pool.query(VEICULO_DA_VIAGEM, [viagem.veiculoId]),
      pool.query(ABASTECIMENTOS, [viagemId]),
    ]);
    if (!veiculo.rows[0]) return null;

    // A autorização é impressa **antes** da viagem sair. Km percorrido só
    // existe depois da finalização; até lá, traço em vez de um zero que o
    // leitor entenderia como "não rodou".
    const kmPercorrido = viagem.finalizacaoKmFinal != null && viagem.retiradaKmInicial != null
      ? numero(Number(viagem.finalizacaoKmFinal) - Number(viagem.retiradaKmInicial))
      : "—";

    return {
      orgao,
      veiculo: veiculoParaContexto(veiculo.rows[0]),
      viagem: {
        status: String(viagem.status),
        motivo: String(viagem.motivo),
        responsavel: String(viagem.responsavel),
        unidadeSolicitante: String(viagem.unidadeSolicitante),
        dataHoraDesejada: String(viagem.dataHoraDesejada),
        dataHoraRemarcada: String(viagem.dataHoraRemarcada),
        kmPercorrido,
        totalLitros: numero(viagem.totalLitros),
        totalCombustivel: dinheiro(viagem.totalCombustivel),
      },
      motorista: {
        nome: String(viagem.motoristaNome),
        cnh: String(viagem.motoristaCnh),
        categoriaCnh: String(viagem.motoristaCategoriaCnh),
        validadeCnh: String(viagem.motoristaValidadeCnh),
      },
      retirada: {
        dataHora: String(viagem.retiradaDataHora),
        kmInicial: viagem.retiradaKmInicial == null ? "—" : numero(viagem.retiradaKmInicial),
        notaCombustivel: String(viagem.retiradaNotaCombustivel),
      },
      finalizacao: {
        dataHora: String(viagem.finalizacaoDataHora),
        kmFinal: viagem.finalizacaoKmFinal == null ? "—" : numero(viagem.finalizacaoKmFinal),
        sinistro: String(viagem.finalizacaoSinistro),
      },
      abastecimentos: abastecimentos.rows.map((linha) => ({
        data: String(linha.data),
        litros: linha.litros == null ? "—" : numero(linha.litros),
        valor: linha.valor == null ? "—" : dinheiro(linha.valor),
      })),
    };
  };

  private daManutencao = async (
    orgaoId: string,
    manutencaoId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const manutencao = (await pool.query(MANUTENCAO, [orgaoId, manutencaoId])).rows[0];
    if (!manutencao) return null;

    const veiculo = (await pool.query(VEICULO_DA_VIAGEM, [manutencao.veiculoId])).rows[0];
    if (!veiculo) return null;

    // Custo é opcional: manutenção aberta em geral ainda não tem orçamento
    // fechado, e escrever "R$ 0,00" seria afirmar que foi de graça.
    const temCusto = manutencao.custo != null;

    return {
      orgao,
      veiculo: veiculoParaContexto(veiculo),
      manutencao: {
        tipo: String(manutencao.tipo) === "PREVENTIVA" ? "Preventiva" : "Corretiva",
        descricao: String(manutencao.descricao),
        oficina: String(manutencao.oficina),
        dataInicio: String(manutencao.dataInicio),
        dataFim: String(manutencao.dataFim),
        status: String(manutencao.status),
        custo: temCusto ? dinheiro(manutencao.custo) : "—",
        custoPorExtenso: temCusto ? valorPorExtenso(Number(manutencao.custo)) : "—",
      },
    };
  };

  // ---- Almoxarifado -------------------------------------------------------

  private doPedido = async (
    orgaoId: string,
    solicitacaoId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const pedido = (await pool.query(PEDIDO_ESTOQUE, [orgaoId, solicitacaoId])).rows[0];
    if (!pedido) return null;

    const [itens, lotes] = await Promise.all([
      pool.query(ITENS_DO_PEDIDO, [solicitacaoId]),
      pool.query(LOTES_DO_PEDIDO, [solicitacaoId]),
    ]);

    return {
      orgao,
      pedido: {
        ...Object.fromEntries(
          Object.entries(pedido).map(([chave, valor]) => [chave, String(valor ?? "—")]),
        ),
        totalItens: String(pedido.totalItens),
        totalLotes: String(pedido.totalLotes),
      },
      // Quantidade que ainda não aconteceu vem como traço, não como zero: um
      // "0" no comprovante do pedido seria lido como "não liberaram nada".
      itens: itens.rows.map((linha) => ({
        produto: String(linha.produto),
        unidadeMedida: String(linha.unidadeMedida),
        solicitado: numero(linha.solicitado),
        liberado: linha.liberado === null ? "—" : numero(linha.liberado),
        recebido: linha.recebido === null ? "—" : numero(linha.recebido),
      })),
      lotes: lotes.rows.map((linha) => ({
        produto: String(linha.produto),
        unidadeMedida: String(linha.unidadeMedida),
        remessa: String(linha.remessa),
        validade: linha.validade ? formatarDataSimples(linha.validade) : "sem validade",
        quantidade: numero(linha.quantidade),
        confirmado: linha.confirmado === null ? "—" : numero(linha.confirmado),
        perdido: Number(linha.perdido) > 0 ? numero(linha.perdido) : "—",
        motivoPerda: MOTIVO_DA_PERDA[String(linha.motivoPerda)] ?? "",
      })),
    };
  };

  private daEntrada = async (
    orgaoId: string,
    remessaId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const entrada = (await pool.query(ENTRADA_ESTOQUE, [orgaoId, remessaId])).rows[0];
    if (!entrada) return null;

    const lotes = await pool.query(LOTES_DA_ENTRADA, [remessaId]);

    return {
      orgao,
      entrada: {
        ...Object.fromEntries(
          Object.entries(entrada).map(([chave, valor]) => [chave, String(valor ?? "—")]),
        ),
        totalLotes: String(entrada.totalLotes),
      },
      lotes: lotes.rows.map((linha) => ({
        produto: String(linha.produto),
        unidadeMedida: String(linha.unidadeMedida),
        quantidade: numero(linha.quantidade),
        validade: linha.validade ? formatarDataSimples(linha.validade) : "sem validade",
      })),
    };
  };

  /**
   * A declaração do checklist.
   *
   * Congela a situação de cada item no dia da emissão. Item recorrente faz um
   * checklist completo voltar a incompleto sozinho — e é por isso que a peça
   * diz "completo em", com data, em vez de "completo".
   */
  private doChecklist = async (
    orgaoId: string,
    checklistId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const checklist = (await pool.query(CHECKLIST, [orgaoId, checklistId])).rows[0];
    if (!checklist) return null;

    const itens = await pool.query(ITENS_DO_CHECKLIST, [checklistId]);

    return {
      orgao,
      checklist: {
        ...Object.fromEntries(
          Object.entries(checklist).map(([chave, valor]) => [chave, String(valor ?? "—")]),
        ),
        totalItens: String(checklist.totalItens),
      },
      itens: itens.rows.map((linha) => ({
        ...Object.fromEntries(
          Object.entries(linha).map(([chave, valor]) => [chave, String(valor ?? "—")]),
        ),
      })),
    };
  };

  /**
   * Comprovante de devolução.
   *
   * Escopo sem lista: a devolução é de um lote só, e uma tabela de uma linha
   * seria enfeite onde cabe uma frase.
   */
  private daDevolucao = async (
    orgaoId: string,
    devolucaoId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const devolucao = (await pool.query(DEVOLUCAO_ESTOQUE, [orgaoId, devolucaoId])).rows[0];
    if (!devolucao) return null;

    return {
      orgao,
      devolucao: {
        ...Object.fromEntries(
          Object.entries(devolucao).map(([chave, valor]) => [chave, String(valor ?? "—")]),
        ),
        quantidade: numero(devolucao.quantidade),
        // A validade é opcional no lote, e "—" mentiria menos que uma data
        // vazia no meio da frase.
        validade: devolucao.validade
          ? formatarDataSimples(devolucao.validade) : "sem validade",
        situacao: SITUACAO_DA_DEVOLUCAO[String(devolucao.situacao)] ?? String(devolucao.situacao),
      },
    };
  };

  /**
   * Relatório de consumo da alimentação escolar.
   *
   * A apuração acontece aqui, na emissão — e o motor congela o resultado em
   * `documento_emitido.dados`. É o que faz a peça valer como prestação de
   * contas: o relatório aberto acompanha o estoque de hoje, e o documento
   * emitido guarda o que era verdade no dia em que saiu.
   */
  private doRelatorio = async (
    orgaoId: string,
    relatorioId: string,
    orgao: Record<string, unknown>,
  ): Promise<ContextoDeDocumento | null> => {
    const apuracao = await this.relatorios.apurar(orgaoId, relatorioId, SEM_TRAVA);
    if (!apuracao) return null;

    const somar = (valores: number[]) =>
      Math.round(valores.reduce((total, valor) => total + valor, 0) * 1000) / 1000;

    return {
      orgao,
      relatorio: {
        almoxarifado: apuracao.almoxarifadoNome,
        tipoEstoque: apuracao.tipoEstoqueNome ?? "todos os tipos",
        periodoInicio: formatarDataSimples(apuracao.periodoInicio),
        periodoFim: formatarDataSimples(apuracao.periodoFim),
        totalRecebido: numero(somar(apuracao.produtos.map((p) => p.recebido))),
        totalConsumido: numero(somar(apuracao.produtos.map((p) => p.consumido))),
        totalPerdido: numero(somar(apuracao.produtos.map((p) => p.perdido))),
        totalDevolvido: numero(somar(apuracao.produtos.map((p) => p.devolvido))),
        unidadesAtendidas: String(apuracao.unidades.length),
        entradasTotal: String(apuracao.entradasTotal),
        entradasAgriculturaFamiliar: String(apuracao.entradasAgriculturaFamiliar),
        agriculturaFamiliarPercentual: percentualDeAgriculturaFamiliar(
          apuracao.entradasTotal, apuracao.entradasAgriculturaFamiliar,
        ),
      },
      unidades: apuracao.unidades.map((unidade) => ({
        nome: unidade.nome,
        cnpj: unidade.cnpj ? mascararDocumento(unidade.cnpj) : "—",
        recebido: numero(unidade.recebido),
        consumido: numero(unidade.consumido),
        perdido: numero(unidade.perdido),
        devolvido: numero(unidade.devolvido),
        saldo: numero(unidade.saldo),
      })),
      produtos: apuracao.produtos.map((produto) => ({
        nome: produto.nome,
        unidadeMedida: produto.unidadeMedida,
        recebido: numero(produto.recebido),
        consumido: numero(produto.consumido),
        perdido: numero(produto.perdido),
        devolvido: numero(produto.devolvido),
      })),
    };
  };
}

/**
 * Contratante da ordem: o que foi informado na emissão, com queda para o órgão.
 *
 * A secretaria é quem responde pela despesa e é ela que a ordem de serviço do
 * legado nomeia. Quando ninguém informa, a prefeitura é a resposta certa.
 */
const contratanteParaContexto = (
  informado: unknown,
  orgao: Record<string, unknown>,
): Record<string, string> => {
  const dados = (typeof informado === "object" && informado !== null
    ? informado
    : {}) as Record<string, unknown>;

  const ou = (chave: string, padrao: unknown) =>
    String(dados[chave] ?? padrao ?? "—") || "—";

  return {
    nome: ou("nome", orgao.nome),
    cnpj: mascararDocumento(ou("cnpj", orgao.cnpj)),
    endereco: ou("endereco", orgao.endereco),
    cidade: ou("cidade", `${orgao.municipio ?? ""} - ${orgao.uf ?? ""}`),
    inscricaoEstadual: ou("inscricaoEstadual", null),
    inscricaoMunicipal: ou("inscricaoMunicipal", null),
  };
};

/** Motivo da perda como se lê num termo, não como está no CHECK. */
const MOTIVO_DA_PERDA: Record<string, string> = {
  QUEBRA_TRANSPORTE: "Quebra no transporte",
  AVARIA: "Avaria",
  VENCIDO: "Vencido",
  EXTRAVIO: "Extravio",
  OUTRO: "Outro",
};

/**
 * Data do banco no formato do documento. O `to_char` resolve nas consultas que
 * o usam direto; aqui a validade vem como `Date` dentro da lista.
 */
/**
 * CNPJ ou CPF do jeito que se lê no papel.
 *
 * O documento é gravado só com dígitos, e saía assim na peça emitida:
 * "08882902000100" onde deveria estar "08.882.902/0001-00". Ninguém confere um
 * CNPJ sem os pontos, e a capa do processo é lida por quem vai comparar com a
 * nota fiscal. Valor que não tem 11 nem 14 dígitos volta como veio — melhor um
 * texto estranho do que uma máscara aplicada sobre o que não é documento.
 */
const mascararDocumento = (valor: string): string => {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length === 14) {
    return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (digitos.length === 11) {
    return digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return valor;
};

const formatarDataSimples = (valor: unknown): string =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(valor instanceof Date ? valor : new Date(String(valor)));

/** Motivo da baixa como se lê num termo, não como está no CHECK. */
const MOTIVO_DA_BAIXA: Record<string, string> = {
  QUEBRADO: "Quebrado / imprestável",
  DOADO: "Doado",
  EXTRAVIADO: "Extraviado",
  LEILAO: "Leilão",
  OUTRO: "Outro",
};

const bemParaContexto = (linha: Record<string, unknown>) => ({
  tombamento: String(linha.tombamento ?? ""),
  nome: String(linha.nome ?? ""),
  categoria: String(linha.categoria ?? ""),
  estadoConservacao: String(linha.estadoConservacao ?? ""),
  status: String(linha.status ?? ""),
  localAtual: String(linha.localAtual ?? ""),
  localTombamento: String(linha.localTombamento ?? ""),
  dataEntrada: String(linha.dataEntrada ?? "—"),
  notaFiscal: String(linha.notaFiscal ?? "—"),
  fornecedor: String(linha.fornecedor ?? "—"),
});

const veiculoParaContexto = (linha: Record<string, unknown>) => ({
  placa: String(linha.placa ?? ""),
  modelo: String(linha.modelo ?? ""),
  ano: String(linha.ano ?? "—"),
  tipo: String(linha.tipo ?? "—"),
  unidade: String(linha.unidade ?? ""),
  quilometragemAtual: numero(linha.quilometragemAtual),
});

/** O status como ele se lê no papel, e não como o banco o guarda. */
const SITUACAO_DA_DEVOLUCAO: Record<string, string> = {
  PENDENTE: "aguardando aceite",
  ACEITA: "aceita",
  RECUSADA: "recusada",
};
