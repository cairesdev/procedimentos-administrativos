import { pool } from "./pool";
import {
  montarPagina, TOTAL_DA_JANELA, deslocamentoDe,
  type Pagina, type Paginacao,
} from "../../application/shared/Paginacao";
import type {
  LicitacaoCompleta,
  EdicaoLicitacao,
  LicitacaoRepository,
  LicitacaoResumo,
  NovaLicitacao,
} from "../../application/ports/LicitacaoRepository";

const SQL = {
  atualizar: `
    UPDATE licitacao
       SET numero = COALESCE($3, numero),
           resumo = CASE WHEN $4::boolean THEN $5 ELSE resumo END,
           objeto = COALESCE($6, objeto),
           modalidade = COALESCE($7, modalidade),
           data_assinatura = COALESCE($8, data_assinatura),
           valor_total = COALESCE($9, valor_total)
     WHERE orgao_id = $1 AND id = $2`,
  limparUnidades: `DELETE FROM licitacao_unidade WHERE licitacao_id = $1`,
  vinculos: `
    SELECT
      (SELECT count(*) FROM contrato WHERE licitacao_id = $2 AND orgao_id = $1) AS contratos,
      (SELECT count(*) FROM ata_registro_precos WHERE licitacao_id = $2 AND orgao_id = $1) AS atas`,
  remover: `DELETE FROM licitacao WHERE orgao_id = $1 AND id = $2`,
  criar: `
    INSERT INTO licitacao (orgao_id, numero, resumo, objeto, modalidade, data_assinatura, valor_total)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id`,
  vincularUnidade: `INSERT INTO licitacao_unidade (licitacao_id, unidade_id) VALUES ($1, $2)`,
  listar: `
    SELECT id, numero, resumo, objeto, modalidade,
           data_assinatura AS "dataAssinatura", valor_total AS "valorTotal",
           ${TOTAL_DA_JANELA}
      FROM licitacao
     WHERE orgao_id = $1
     ORDER BY data_assinatura DESC, id
     LIMIT $2 OFFSET $3`,
  // Contratos da licitação: os assinados direto e os que vieram por ata dela.
  contratosDaLicitacao: `
    SELECT c.id, c.numero, f.razao_social AS "fornecedorRazaoSocial",
           c.data_inicio AS "dataInicio", c.data_fim AS "dataFim",
           c.valor_total AS "valorTotal",
           a.numero AS "viaAta"
      FROM contrato c
      JOIN fornecedor f ON f.id = c.fornecedor_id
      LEFT JOIN ata_registro_precos a ON a.id = c.ata_id
     WHERE c.orgao_id = $1
       AND (c.licitacao_id = $2 OR a.licitacao_id = $2)
     ORDER BY c.data_inicio DESC, c.numero`,
  atasDaLicitacao: `
    SELECT a.id, a.numero, a.data_vigencia AS "dataVigencia", a.valor_total AS "valorTotal",
           (SELECT count(*) FROM contrato c WHERE c.ata_id = a.id) AS contratos
      FROM ata_registro_precos a
     WHERE a.orgao_id = $1 AND a.licitacao_id = $2
     ORDER BY a.numero`,
  buscarPorId: `
    SELECT id, numero, resumo, objeto, modalidade,
           data_assinatura AS "dataAssinatura", valor_total AS "valorTotal"
      FROM licitacao
     WHERE orgao_id = $1 AND id = $2`,
};

export class PostgresLicitacaoRepository implements LicitacaoRepository {

  atualizar = async (orgaoId: string, id: string, dados: EdicaoLicitacao): Promise<void> => {
    await pool.query(SQL.atualizar, [
      orgaoId, id, dados.numero ?? null,
      dados.resumo !== undefined, dados.resumo ?? null,
      dados.objeto ?? null, dados.modalidade ?? null,
      dados.dataAssinatura ?? null, dados.valorTotal ?? null,
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

  remover = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.limparUnidades, [id]);
    await pool.query(SQL.remover, [orgaoId, id]);
  };

  criar = async (dados: NovaLicitacao): Promise<string> => {
    const { rows } = await pool.query(SQL.criar, [
      dados.orgaoId,
      dados.numero,
      dados.resumo ?? null,
      dados.objeto,
      dados.modalidade,
      dados.dataAssinatura,
      dados.valorTotal,
    ]);
    const id: string = rows[0].id;
    for (const unidadeId of dados.unidadesDestinadas) {
      await pool.query(SQL.vincularUnidade, [id, unidadeId]);
    }
    return id;
  };

  listar = async (
    orgaoId: string,
    paginacao: Paginacao,
  ): Promise<Pagina<LicitacaoResumo>> => {
    const { rows } = await pool.query(SQL.listar, [
      orgaoId, paginacao.porPagina, deslocamentoDe(paginacao),
    ]);
    return montarPagina(rows, paginacao);
  };

  buscarPorId = async (orgaoId: string, id: string): Promise<LicitacaoResumo | null> => {
    const { rows } = await pool.query(SQL.buscarPorId, [orgaoId, id]);
    return rows[0] ?? null;
  };

  buscarCompleta = async (orgaoId: string, id: string): Promise<LicitacaoCompleta | null> => {
    const licitacao = await this.buscarPorId(orgaoId, id);
    if (!licitacao) return null;

    const [contratos, atas] = await Promise.all([
      pool.query(SQL.contratosDaLicitacao, [orgaoId, id]),
      pool.query(SQL.atasDaLicitacao, [orgaoId, id]),
    ]);
    return {
      ...licitacao,
      contratos: contratos.rows,
      atas: atas.rows.map((linha) => ({ ...linha, contratos: Number(linha.contratos) })),
    };
  };
}
