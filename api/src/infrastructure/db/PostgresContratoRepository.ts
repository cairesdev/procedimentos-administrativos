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
  EdicaoItemContrato,
  ItemDoContrato,
  EdicaoContrato,
  ItemComSaldo,
  NovoContrato,
} from "../../application/ports/ContratoRepository";

/**
 * Categoria vazia é ausência de categoria.
 *
 * `''` e `NULL` são o mesmo "sem categoria" para quem lê a tela, mas
 * agrupariam em dois blocos distintos — e o CHECK da tabela recusa string em
 * branco justamente para o caso não existir no banco.
 */
const categoriaLimpa = (valor?: string | null): string | null =>
  valor?.trim() || null;

const SQL = {
  criar: `
    INSERT INTO contrato (orgao_id, numero, fornecedor_id, licitacao_id, ata_id,
                          data_inicio, data_fim, valor_total, fiscal_nome_matricula)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id`,
  vincularUnidade: `INSERT INTO contrato_unidade (contrato_id, unidade_id) VALUES ($1, $2)`,
  criarItem: `
    INSERT INTO item (orgao_id, contrato_id, produto, descricao, unidade_medida, marca,
                      quantidade_total, saldo_disponivel, modo_medicao, valor_unitario,
                      valor_total, categoria)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11)`,
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
           -- A apresentação da tela: quem abre um contrato quer saber, antes
           -- de tudo, de quem se trata e como falar com ele.
           f.endereco AS "fornecedorEndereco", f.email AS "fornecedorEmail",
           f.telefone AS "fornecedorTelefone",
           f.inscricao_estadual AS "fornecedorInscricaoEstadual",
           l.modalidade AS "origemModalidade",
           coalesce(a.valor_total, l.valor_total) AS "origemValor",
           coalesce(to_char(a.data_assinatura, 'YYYY-MM-DD'),
                    to_char(l.data_assinatura, 'YYYY-MM-DD')) AS "origemData",
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
       -- A busca é por número, objeto, fornecedor ou **produto**: são os jeitos
       -- de o servidor se referir ao contrato, e quem vai pedir seringa pensa
       -- na seringa, não no número do contrato que a tem. Sem texto, $3 é nulo
       -- e a cláusula some — a lista completa serve a quem tem poucos contratos.
       AND ($3::text IS NULL OR
            c.numero ILIKE $3 OR
            f.razao_social ILIKE $3 OR
            coalesce(a.objeto, l.objeto, '') ILIKE $3 OR
            coalesce(a.numero, l.numero, '') ILIKE $3 OR
            -- EXISTS com alias próprio, e não i.produto ILIKE $3: filtrar pelo
            -- join que agrega deixaria de fora os outros itens, e a linha viria
            -- com o saldo só do item que casou.
            EXISTS (SELECT 1 FROM item ip
                     WHERE ip.contrato_id = c.id
                       AND ip.saldo_disponivel > 0
                       AND ip.produto ILIKE $3))
     GROUP BY c.id, c.numero, a.objeto, l.objeto, f.razao_social,
              c.data_inicio, c.data_fim, c.valor_total, a.numero, l.numero
    HAVING count(i.id) FILTER (WHERE i.saldo_disponivel > 0) > 0
     ORDER BY c.numero
     LIMIT 30`,
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
           licitacao_id AS "licitacaoId",
           data_inicio AS "dataInicio", data_fim AS "dataFim", valor_total AS "valorTotal"
      FROM contrato WHERE orgao_id = $1 AND id = $2`,
  atualizar: `
    UPDATE contrato
       SET data_inicio = COALESCE($3, data_inicio),
           data_fim = CASE WHEN $4::boolean THEN $5 ELSE data_fim END,
           fiscal_nome_matricula = CASE WHEN $6::boolean THEN $7 ELSE fiscal_nome_matricula END,
           valor_total = COALESCE($8, valor_total)
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
           valor_total AS "valorTotal", categoria
      FROM item
     WHERE orgao_id = $1 AND contrato_id = $2
     ORDER BY categoria NULLS LAST, produto`,

  buscarItem: `
    SELECT id, contrato_id AS "contratoId", produto, descricao,
           unidade_medida AS "unidadeMedida", marca,
           quantidade_total AS "quantidadeTotal", saldo_disponivel AS "saldoDisponivel",
           modo_medicao AS "modoMedicao", valor_unitario AS "valorUnitario",
           valor_total AS "valorTotal", categoria,
           quantidade_total - saldo_disponivel AS consumido
      FROM item
     WHERE orgao_id = $1 AND id = $2`,

  /**
   * O saldo acompanha a quantidade.
   *
   * Corrigir 1.000 para 1.200 precisa somar 200 ao saldo, e não deixá-lo como
   * estava: senão o contrato passa a ter 200 unidades que ninguém pode pedir.
   * A diferença é aplicada ao saldo; o `CHECK` da tabela recusa se o resultado
   * for negativo, e o caso de uso confere antes para dizer por quê.
   */
  atualizarItem: `
    UPDATE item
       SET produto = $3, descricao = $4, unidade_medida = $5, marca = $6,
           saldo_disponivel = saldo_disponivel + ($7 - quantidade_total),
           quantidade_total = $7,
           modo_medicao = $8, valor_unitario = $9, valor_total = $10,
           categoria = $11
     WHERE orgao_id = $1 AND id = $2`,

  removerItem: `DELETE FROM item WHERE orgao_id = $1 AND id = $2`,

  tetoDaLicitacao: `
    SELECT li.valor_total AS "valorLicitacao",
           coalesce((
             SELECT sum(c.valor_total) FROM contrato c
              WHERE c.licitacao_id = li.id
                AND c.id <> coalesce($3, '00000000-0000-0000-0000-000000000000'::uuid)
           ), 0) AS "jaContratado"
      FROM licitacao li
     WHERE li.orgao_id = $1 AND li.id = $2`,
};

export class PostgresContratoRepository implements ContratoRepository {
  tetoDaLicitacao = async (orgaoId: string, licitacaoId: string, exceto?: string) => {
    const { rows } = await pool.query(SQL.tetoDaLicitacao, [orgaoId, licitacaoId, exceto ?? null]);
    const linha = rows[0];
    if (!linha) return null;
    return {
      valorLicitacao: Number(linha.valorLicitacao),
      jaContratado: Number(linha.jaContratado),
    };
  };

  buscarItem = async (orgaoId: string, itemId: string): Promise<ItemDoContrato | null> => {
    const { rows } = await pool.query(SQL.buscarItem, [orgaoId, itemId]);
    const linha = rows[0];
    if (!linha) return null;
    return {
      ...linha,
      quantidadeTotal: Number(linha.quantidadeTotal),
      saldoDisponivel: Number(linha.saldoDisponivel),
      valorUnitario: Number(linha.valorUnitario),
      valorTotal: Number(linha.valorTotal),
      consumido: Number(linha.consumido),
    } as ItemDoContrato;
  };

  atualizarItem = async (
    orgaoId: string, itemId: string, dados: EdicaoItemContrato,
  ): Promise<void> => {
    await pool.query(SQL.atualizarItem, [
      orgaoId, itemId, dados.produto, dados.descricao ?? null, dados.unidadeMedida,
      dados.marca ?? null, dados.quantidadeTotal, dados.modoMedicao,
      dados.valorUnitario, dados.valorTotal, categoriaLimpa(dados.categoria),
    ]);
  };

  removerItem = async (orgaoId: string, itemId: string): Promise<void> => {
    await pool.query(SQL.removerItem, [orgaoId, itemId]);
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
        categoriaLimpa(item.categoria),
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
      valorTotal: Number(contrato.valorTotal),
      // `NUMERIC` vem como string do driver; a tela soma e compara este número
      // com o dos itens para avisar quando divergem.
      origemValor: contrato.origemValor === null ? null : Number(contrato.origemValor),
      solicitacoes: Number(contrato.solicitacoes),
      unidades: unidades.rows,
      itens,
    };
  };

  listarParaSolicitacao = async (
    orgaoId: string,
    unidadeId?: string,
    busca?: string,
  ): Promise<ContratoParaSolicitacao[]> => {
    const texto = busca?.trim();
    const { rows } = await pool.query(SQL.listarParaSolicitacao, [
      orgaoId, unidadeId ?? null, texto ? `%${texto}%` : null,
    ]);
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
      dados.valorTotal ?? null,
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
