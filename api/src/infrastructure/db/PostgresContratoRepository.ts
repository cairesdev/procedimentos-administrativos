import { pool } from "./pool";
import {
  montarPagina, TOTAL_DA_JANELA, deslocamentoDe,
  type Pagina, type Paginacao,
} from "../../application/shared/Paginacao";
import type { Tx } from "../../application/ports/Transacao";
import type {
  ContratoCompleto,
  ContratoParaSolicitacao,
  ContratoDetalhe,
  ContratoRepository,
  ContratoResumo,
  EdicaoContrato,
  ItemComSaldo,
  NovoContrato,
} from "../../application/ports/ContratoRepository";

const SQL = {
  existeNumero: `SELECT 1 FROM contrato WHERE orgao_id = $1 AND numero = $2`,
  criar: `
    INSERT INTO contrato (orgao_id, numero, fornecedor_id, licitacao_id, ata_id,
                          data_inicio, data_fim, valor_total, fiscal_nome_matricula)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id`,
  vincularUnidade: `INSERT INTO contrato_unidade (contrato_id, unidade_id) VALUES ($1, $2)`,
  criarItem: `
    INSERT INTO item (orgao_id, contrato_id, produto, descricao, unidade_medida, marca,
                      quantidade_total, saldo_disponivel, modo_medicao, valor_unitario, valor_total)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10)`,
  listar: `
    SELECT id, numero, fornecedor_id AS "fornecedorId",
           data_inicio AS "dataInicio", data_fim AS "dataFim", valor_total AS "valorTotal",
           ${TOTAL_DA_JANELA}
      FROM contrato c
     WHERE c.orgao_id = $1
       AND ($4::uuid IS NULL OR EXISTS (
             SELECT 1 FROM contrato_unidade cu
              WHERE cu.contrato_id = c.id AND cu.unidade_id = $4))
     ORDER BY data_inicio DESC, id
     LIMIT $2 OFFSET $3`,

  // Detalhe: contrato, fornecedor e a origem (licitação direta ou ata, e a
  // licitação que gerou a ata) numa consulta só.
  buscarCompleto: `
    SELECT c.id, c.numero, c.fornecedor_id AS "fornecedorId",
           c.processo_id AS "processoId",
           c.data_inicio AS "dataInicio", c.data_fim AS "dataFim",
           c.valor_total AS "valorTotal",
           c.fiscal_nome_matricula AS "fiscalNomeMatricula",
           f.razao_social AS "fornecedorRazaoSocial", f.documento AS "fornecedorDocumento",
           CASE WHEN c.ata_id IS NOT NULL THEN 'ATA' ELSE 'LICITACAO' END AS origem,
           coalesce(c.ata_id, c.licitacao_id) AS "origemId",
           coalesce(a.numero, l.numero) AS "origemNumero",
           coalesce(a.objeto, l.objeto) AS "origemObjeto",
           la.id AS "licitacaoDaAtaId", la.numero AS "licitacaoDaAtaNumero",
           (SELECT count(DISTINCT si.solicitacao_id)
              FROM solicitacao_item si
              JOIN item i ON i.id = si.item_id
             WHERE i.contrato_id = c.id) AS solicitacoes
      FROM contrato c
      JOIN fornecedor f ON f.id = c.fornecedor_id
      LEFT JOIN ata_registro_precos a ON a.id = c.ata_id
      LEFT JOIN licitacao l ON l.id = c.licitacao_id
      LEFT JOIN licitacao la ON la.id = a.licitacao_id
     WHERE c.orgao_id = $1 AND c.id = $2`,

  unidadesDoContrato: `
    SELECT u.id, u.nome
      FROM contrato_unidade cu
      JOIN unidade u ON u.id = cu.unidade_id
     WHERE cu.contrato_id = $1
     ORDER BY u.nome`,

  // Montagem da solicitação: vigente, com saldo e destinado à unidade. Sem
  // isso, a tela oferecia contrato de outra unidade e o pedido só falhava na
  // hora do envio.
  listarParaSolicitacao: `
    SELECT c.id, c.numero,
           -- O contrato não tem objeto próprio: ele vem da ata ou da licitação
           -- que o originou. É o que diz ao solicitante do que trata o contrato,
           -- e sem isso a lista era só um número.
           coalesce(a.objeto, l.objeto, '') AS objeto,
           f.razao_social AS "fornecedorRazaoSocial",
           c.data_inicio AS "dataInicio", c.data_fim AS "dataFim",
           c.valor_total AS "valorTotal",
           CASE WHEN c.ata_id IS NOT NULL THEN 'ATA' ELSE 'LICITACAO' END AS origem,
           coalesce(a.numero, l.numero) AS "origemNumero",
           count(i.id) FILTER (WHERE i.saldo_disponivel > 0) AS "itensDisponiveis",
           -- Saldo em dinheiro do que ainda dá para pedir. Item medido por
           -- percentual ou por valor não tem quantidade × preço, então entra
           -- pelo próprio saldo.
           coalesce(sum(
             CASE
               WHEN i.saldo_disponivel <= 0 THEN 0
               WHEN i.modo_medicao = 'UNIDADE' THEN i.saldo_disponivel * i.valor_unitario
               ELSE i.saldo_disponivel
             END
           ), 0) AS "saldoDisponivel"
      FROM contrato c
      JOIN fornecedor f ON f.id = c.fornecedor_id
      LEFT JOIN ata_registro_precos a ON a.id = c.ata_id
      LEFT JOIN licitacao l ON l.id = c.licitacao_id
      JOIN item i ON i.contrato_id = c.id
     WHERE c.orgao_id = $1
       AND (c.data_fim IS NULL OR c.data_fim >= current_date)
       AND ($2::uuid IS NULL OR EXISTS (
             SELECT 1 FROM contrato_unidade cu
              WHERE cu.contrato_id = c.id AND cu.unidade_id = $2))
     GROUP BY c.id, c.numero, a.objeto, l.objeto, f.razao_social,
              c.data_inicio, c.data_fim, c.valor_total, a.numero, l.numero
    HAVING count(i.id) FILTER (WHERE i.saldo_disponivel > 0) > 0
     ORDER BY c.numero`,
  unidadeTemAcesso: `SELECT 1 FROM contrato_unidade WHERE contrato_id = $1 AND unidade_id = $2`,
  contratosForaDaUnidade: `
    SELECT c.numero
      FROM contrato c
     WHERE c.orgao_id = $1 AND c.id = ANY($2::uuid[])
       AND NOT EXISTS (
             SELECT 1 FROM contrato_unidade cu
              WHERE cu.contrato_id = c.id AND cu.unidade_id = $3)
     ORDER BY c.numero`,
  buscar: `
    SELECT id, numero, fornecedor_id AS "fornecedorId", processo_id AS "processoId",
           data_inicio AS "dataInicio", data_fim AS "dataFim", valor_total AS "valorTotal"
      FROM contrato WHERE orgao_id = $1 AND id = $2`,
  atualizar: `
    UPDATE contrato
       SET data_inicio = COALESCE($3, data_inicio),
           data_fim = CASE WHEN $4::boolean THEN $5 ELSE data_fim END,
           fiscal_nome_matricula = CASE WHEN $6::boolean THEN $7 ELSE fiscal_nome_matricula END
     WHERE orgao_id = $1 AND id = $2`,
  limparUnidades: `DELETE FROM contrato_unidade WHERE contrato_id = $1`,
  vinculos: `
    SELECT
      (SELECT count(*) FROM solicitacao_item si
         JOIN item i ON i.id = si.item_id
        WHERE i.contrato_id = $2 AND i.orgao_id = $1) AS itens_em_solicitacoes,
      (SELECT count(*) FROM ordem_fornecimento
        WHERE contrato_id = $2 AND orgao_id = $1) AS ordens_de_fornecimento,
      (SELECT count(*) FROM item
        WHERE contrato_id = $2 AND orgao_id = $1
          AND saldo_disponivel <> quantidade_total) AS itens_com_saldo_consumido`,
  limparItens: `DELETE FROM item WHERE contrato_id = $1 AND orgao_id = $2`,
  removerCampos: `DELETE FROM contrato_campo_extra WHERE contrato_id = $1`,
  removerDotacoes: `DELETE FROM dotacao_orcamentaria WHERE contrato_id = $1`,
  remover: `DELETE FROM contrato WHERE orgao_id = $1 AND id = $2`,
  listarItens: `
    SELECT id, produto, descricao, unidade_medida AS "unidadeMedida", marca,
           quantidade_total AS "quantidadeTotal", saldo_disponivel AS "saldoDisponivel",
           modo_medicao AS "modoMedicao", valor_unitario AS "valorUnitario",
           valor_total AS "valorTotal"
      FROM item
     WHERE orgao_id = $1 AND contrato_id = $2
     ORDER BY produto`,
};

export class PostgresContratoRepository implements ContratoRepository {
  existeNumero = async (orgaoId: string, numero: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.existeNumero, [orgaoId, numero]);
    return (rowCount ?? 0) > 0;
  };

  criar = async (dados: NovoContrato, tx: Tx): Promise<string> => {
    const { rows } = await tx.query(SQL.criar, [
      dados.orgaoId,
      dados.numero,
      dados.fornecedorId,
      dados.licitacaoId ?? null,
      dados.ataId ?? null,
      dados.dataInicio,
      dados.dataFim ?? null,
      dados.valorTotal,
      dados.fiscalNomeMatricula ?? null,
    ]);
    const id: string = rows[0].id;

    for (const unidadeId of dados.unidadesDestinadas) {
      await tx.query(SQL.vincularUnidade, [id, unidadeId]);
    }
    for (const item of dados.itens) {
      await tx.query(SQL.criarItem, [
        dados.orgaoId,
        id,
        item.produto,
        item.descricao ?? null,
        item.unidadeMedida,
        item.marca ?? null,
        item.quantidadeTotal,
        item.modoMedicao,
        item.valorUnitario,
        item.valorTotal,
      ]);
    }
    return id;
  };

  listar = async (
    orgaoId: string,
    paginacao: Paginacao,
    filtros: { unidadeId?: string } = {},
  ): Promise<Pagina<ContratoResumo>> => {
    const { rows } = await pool.query(SQL.listar, [
      orgaoId, paginacao.porPagina, deslocamentoDe(paginacao), filtros.unidadeId ?? null,
    ]);
    return montarPagina(rows, paginacao);
  };

  buscarCompleto = async (orgaoId: string, id: string): Promise<ContratoCompleto | null> => {
    const { rows } = await pool.query(SQL.buscarCompleto, [orgaoId, id]);
    const contrato = rows[0];
    if (!contrato) return null;

    const [unidades, itens] = await Promise.all([
      pool.query(SQL.unidadesDoContrato, [id]),
      this.listarItens(orgaoId, id),
    ]);
    return {
      ...contrato,
      solicitacoes: Number(contrato.solicitacoes),
      unidades: unidades.rows,
      itens,
    };
  };

  listarParaSolicitacao = async (
    orgaoId: string,
    unidadeId?: string,
  ): Promise<ContratoParaSolicitacao[]> => {
    const { rows } = await pool.query(SQL.listarParaSolicitacao, [orgaoId, unidadeId ?? null]);
    // `count` e `sum` voltam como string no driver: sem o Number, o valor
    // chegaria à tela como texto e a formatação de moeda mostraria NaN.
    return rows.map((linha) => ({
      ...linha,
      itensDisponiveis: Number(linha.itensDisponiveis),
      valorTotal: Number(linha.valorTotal),
      saldoDisponivel: Number(linha.saldoDisponivel),
    }));
  };

  contratosForaDaUnidade = async (
    orgaoId: string,
    contratoIds: string[],
    unidadeId: string,
  ): Promise<string[]> => {
    if (contratoIds.length === 0) return [];
    const { rows } = await pool.query(SQL.contratosForaDaUnidade, [
      orgaoId, contratoIds, unidadeId,
    ]);
    return rows.map((linha) => String(linha.numero));
  };

  unidadeTemAcesso = async (contratoId: string, unidadeId: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.unidadeTemAcesso, [contratoId, unidadeId]);
    return (rowCount ?? 0) > 0;
  };

  buscar = async (orgaoId: string, id: string): Promise<ContratoDetalhe | null> => {
    const { rows } = await pool.query(SQL.buscar, [orgaoId, id]);
    return rows[0] ?? null;
  };

  atualizar = async (orgaoId: string, id: string, dados: EdicaoContrato): Promise<void> => {
    await pool.query(SQL.atualizar, [
      orgaoId, id, dados.dataInicio ?? null,
      dados.dataFim !== undefined, dados.dataFim ?? null,
      dados.fiscalNomeMatricula !== undefined, dados.fiscalNomeMatricula ?? null,
    ]);

    if (dados.unidadesDestinadas) {
      await pool.query(SQL.limparUnidades, [id]);
      for (const unidadeId of dados.unidadesDestinadas) {
        await pool.query(SQL.vincularUnidade, [id, unidadeId]);
      }
    }
  };

  contarVinculos = async (orgaoId: string, id: string): Promise<Record<string, number>> => {
    const { rows } = await pool.query(SQL.vinculos, [orgaoId, id]);
    return Object.fromEntries(
      Object.entries(rows[0] as Record<string, string>)
        .map(([chave, valor]) => [chave, Number(valor)])
        .filter(([, quantidade]) => (quantidade as number) > 0),
    );
  };

  remover = async (orgaoId: string, id: string, tx: Tx): Promise<void> => {
    await tx.query(SQL.removerCampos, [id]);
    await tx.query(SQL.removerDotacoes, [id]);
    await tx.query(SQL.limparItens, [id, orgaoId]);
    await tx.query(SQL.limparUnidades, [id]);
    await tx.query(SQL.remover, [orgaoId, id]);
  };

  listarItens = async (orgaoId: string, contratoId: string): Promise<ItemComSaldo[]> => {
    const { rows } = await pool.query(SQL.listarItens, [orgaoId, contratoId]);
    return rows.map((i) => ({
      ...i,
      quantidadeTotal: Number(i.quantidadeTotal),
      saldoDisponivel: Number(i.saldoDisponivel),
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
    }));
  };
}
