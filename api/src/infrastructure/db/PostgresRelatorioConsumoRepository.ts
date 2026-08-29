import { pool } from "./pool";
import type {
  ApuracaoDoRelatorio, NovoRelatorioConsumo, RelatorioConsumo,
  RelatorioConsumoRepository,
} from "../../application/ports/RelatorioConsumoRepository";

const COLUNAS = `
  r.id, r.almoxarifado_id AS "almoxarifadoId", a.nome AS "almoxarifadoNome",
  r.tipo_estoque_id AS "tipoEstoqueId", t.nome AS "tipoEstoqueNome",
  r.periodo_inicio AS "periodoInicio", r.periodo_fim AS "periodoFim",
  u.nome AS "criadoPorNome", r.criado_em AS "criadoEm"`;

/**
 * Recebido e perdido saem da mesma linha de `liberacao_lote`, e as duas
 * dependem do recebimento ter sido confirmado — `confirmada_em` no período.
 *
 * O corte é pela data da confirmação, não da liberação: material despachado em
 * março e conferido em abril é movimento de abril, que é quando a escola
 * assumiu a responsabilidade por ele.
 */
const RECEBIDO_E_PERDIDO = `
  SELECT s.local_solicitante_id AS local_id,
         si.produto_id,
         sum(coalesce(ll.quantidade_confirmada, 0)) AS recebido,
         sum(ll.quantidade_perdida) AS perdido
    FROM liberacao_lote ll
    JOIN solicitacao_estoque_item si ON si.id = ll.solicitacao_item_id
    JOIN solicitacao_estoque s ON s.id = si.solicitacao_id
    JOIN local l ON l.id = s.local_solicitante_id
    JOIN lote lo ON lo.id = ll.lote_id
    JOIN remessa_estoque re ON re.id = lo.remessa_id
   WHERE l.orgao_id = $1
     AND re.almoxarifado_id = $2
     AND ($3::uuid IS NULL OR re.tipo_estoque_id = $3)
     AND ll.confirmada_em IS NOT NULL
     AND ll.confirmada_em::date BETWEEN $4 AND $5
   GROUP BY s.local_solicitante_id, si.produto_id`;

/** O que a unidade declarou usar no período. */
const CONSUMIDO = `
  SELECT c.local_id, c.produto_id, sum(c.quantidade) AS consumido
    FROM consumo c
    JOIN local l ON l.id = c.local_id
   WHERE l.orgao_id = $1
     AND l.almoxarifado_id = $2
     AND c.data::date BETWEEN $4 AND $5
     AND ($3::uuid IS NULL OR EXISTS (
           SELECT 1 FROM estoque_local el
             JOIN lote lo ON lo.id = el.lote_origem_id
             JOIN remessa_estoque re ON re.id = lo.remessa_id
            WHERE el.local_id = c.local_id AND el.produto_id = c.produto_id
              AND re.tipo_estoque_id = $3))
   GROUP BY c.local_id, c.produto_id`;

/**
 * Só devolução **aceita**. Pendente ainda não voltou ao saldo de ninguém, e
 * recusada nunca voltará — contá-las diria que a escola devolveu o que ainda
 * está com ela.
 */
const DEVOLVIDO = `
  SELECT d.local_id, d.produto_id, sum(d.quantidade) AS devolvido
    FROM devolucao d
    JOIN local l ON l.id = d.local_id
   WHERE l.orgao_id = $1
     AND d.almoxarifado_id = $2
     AND d.status = 'ACEITA'
     AND d.respondida_em::date BETWEEN $4 AND $5
   GROUP BY d.local_id, d.produto_id`;

const SQL = {
  criar: `
    INSERT INTO relatorio_consumo
      (orgao_id, almoxarifado_id, tipo_estoque_id, periodo_inicio, periodo_fim, criado_por)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id`,

  listar: `
    SELECT ${COLUNAS}
      FROM relatorio_consumo r
      JOIN almoxarifado a ON a.id = r.almoxarifado_id
      LEFT JOIN tipo_estoque t ON t.id = r.tipo_estoque_id
      LEFT JOIN usuario u ON u.id = r.criado_por
     WHERE r.orgao_id = $1
     ORDER BY r.criado_em DESC`,

  buscar: `
    SELECT ${COLUNAS}
      FROM relatorio_consumo r
      JOIN almoxarifado a ON a.id = r.almoxarifado_id
      LEFT JOIN tipo_estoque t ON t.id = r.tipo_estoque_id
      LEFT JOIN usuario u ON u.id = r.criado_por
     WHERE r.orgao_id = $1 AND r.id = $2`,

  excluir: `DELETE FROM relatorio_consumo WHERE orgao_id = $1 AND id = $2`,

  /**
   * Movimento por unidade.
   *
   * `FULL JOIN` entre as três origens: uma escola pode ter consumido sem ter
   * recebido no período (usou o que já estava no armário), ou devolvido sem
   * ter consumido. Um `LEFT JOIN` a partir de qualquer uma delas perderia
   * essas linhas — e o relatório omitiria justamente a escola cujo movimento
   * chama atenção.
   */
  porUnidade: `
    WITH recebido AS (${RECEBIDO_E_PERDIDO}),
         consumido AS (${CONSUMIDO}),
         devolvido AS (${DEVOLVIDO}),
         juntos AS (
           SELECT coalesce(r.local_id, c.local_id, d.local_id) AS local_id,
                  sum(coalesce(r.recebido, 0)) AS recebido,
                  sum(coalesce(r.perdido, 0)) AS perdido,
                  sum(coalesce(c.consumido, 0)) AS consumido,
                  sum(coalesce(d.devolvido, 0)) AS devolvido
             FROM recebido r
             FULL JOIN consumido c
               ON c.local_id = r.local_id AND c.produto_id = r.produto_id
             FULL JOIN devolvido d
               ON d.local_id = coalesce(r.local_id, c.local_id)
              AND d.produto_id = coalesce(r.produto_id, c.produto_id)
            GROUP BY coalesce(r.local_id, c.local_id, d.local_id)
         )
    SELECT j.local_id AS "localId", l.nome, l.cnpj,
           j.recebido, j.consumido, j.perdido, j.devolvido,
           -- Saldo de hoje no armário da unidade: é o que ela tem agora, e
           -- não o que sobrou no fim do período.
           coalesce((SELECT sum(el.saldo) FROM estoque_local el
                      WHERE el.local_id = j.local_id), 0) AS saldo
      FROM juntos j
      JOIN local l ON l.id = j.local_id
     ORDER BY l.nome`,

  porProduto: `
    WITH recebido AS (${RECEBIDO_E_PERDIDO}),
         consumido AS (${CONSUMIDO}),
         devolvido AS (${DEVOLVIDO}),
         juntos AS (
           SELECT coalesce(r.produto_id, c.produto_id, d.produto_id) AS produto_id,
                  sum(coalesce(r.recebido, 0)) AS recebido,
                  sum(coalesce(r.perdido, 0)) AS perdido,
                  sum(coalesce(c.consumido, 0)) AS consumido,
                  sum(coalesce(d.devolvido, 0)) AS devolvido
             FROM recebido r
             FULL JOIN consumido c
               ON c.local_id = r.local_id AND c.produto_id = r.produto_id
             FULL JOIN devolvido d
               ON d.local_id = coalesce(r.local_id, c.local_id)
              AND d.produto_id = coalesce(r.produto_id, c.produto_id)
            GROUP BY coalesce(r.produto_id, c.produto_id, d.produto_id)
         )
    SELECT j.produto_id AS "produtoId", p.nome,
           p.unidade_medida AS "unidadeMedida",
           j.recebido, j.consumido, j.perdido, j.devolvido
      FROM juntos j
      JOIN produto p ON p.id = j.produto_id
     ORDER BY p.nome`,

  /**
   * Remessas que entraram no período, e quantas vieram da agricultura familiar.
   *
   * Por contagem de remessas, não por valor: a entrada registra quantidade e
   * não guarda preço. A peça diz isso na folha, para o número não ser
   * apresentado como o percentual financeiro que o FNDE cobra.
   */
  agriculturaFamiliar: `
    SELECT count(*) AS total,
           count(*) FILTER (WHERE f.agricultura_familiar) AS "daAgricultura"
      FROM remessa_estoque re
      JOIN almoxarifado a ON a.id = re.almoxarifado_id
      LEFT JOIN fornecedor f ON f.id = re.fornecedor_id
     WHERE a.orgao_id = $1
       AND re.almoxarifado_id = $2
       AND ($3::uuid IS NULL OR re.tipo_estoque_id = $3)
       AND re.data BETWEEN $4 AND $5`,
};

const numero = (valor: unknown): number => Math.round(Number(valor ?? 0) * 1000) / 1000;

export class PostgresRelatorioConsumoRepository implements RelatorioConsumoRepository {
  criar = async (dados: NovoRelatorioConsumo): Promise<string> => {
    const { rows } = await pool.query(SQL.criar, [
      dados.orgaoId, dados.almoxarifadoId, dados.tipoEstoqueId ?? null,
      dados.periodoInicio, dados.periodoFim, dados.usuarioId,
    ]);
    return rows[0].id;
  };

  listar = async (orgaoId: string): Promise<RelatorioConsumo[]> => {
    const { rows } = await pool.query(SQL.listar, [orgaoId]);
    return rows;
  };

  apurar = async (orgaoId: string, id: string): Promise<ApuracaoDoRelatorio | null> => {
    const { rows } = await pool.query(SQL.buscar, [orgaoId, id]);
    const relatorio = rows[0] as RelatorioConsumo | undefined;
    if (!relatorio) return null;

    const parametros = [
      orgaoId,
      relatorio.almoxarifadoId,
      relatorio.tipoEstoqueId,
      relatorio.periodoInicio,
      relatorio.periodoFim,
    ];

    const [unidades, produtos, agricultura] = await Promise.all([
      pool.query(SQL.porUnidade, parametros),
      pool.query(SQL.porProduto, parametros),
      pool.query(SQL.agriculturaFamiliar, parametros),
    ]);

    return {
      ...relatorio,
      unidades: unidades.rows.map((linha) => ({
        localId: linha.localId,
        nome: linha.nome,
        cnpj: linha.cnpj,
        recebido: numero(linha.recebido),
        consumido: numero(linha.consumido),
        perdido: numero(linha.perdido),
        devolvido: numero(linha.devolvido),
        saldo: numero(linha.saldo),
      })),
      produtos: produtos.rows.map((linha) => ({
        produtoId: linha.produtoId,
        nome: linha.nome,
        unidadeMedida: linha.unidadeMedida,
        recebido: numero(linha.recebido),
        consumido: numero(linha.consumido),
        perdido: numero(linha.perdido),
        devolvido: numero(linha.devolvido),
      })),
      entradasTotal: Number(agricultura.rows[0]?.total ?? 0),
      entradasAgriculturaFamiliar: Number(agricultura.rows[0]?.daAgricultura ?? 0),
    };
  };

  excluir = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.excluir, [orgaoId, id]);
  };
}
