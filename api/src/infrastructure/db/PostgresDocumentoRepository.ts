import { pool } from "./pool";
import {
  montarPagina, TOTAL_DA_JANELA, deslocamentoDe,
  type Pagina, type Paginacao,
} from "../../application/shared/Paginacao";
import type {
  DocumentoEmitido, DocumentoParaConferencia, DocumentoRepository, ModeloDeDocumento,
  ModeloResolvido, NovoDocumentoEmitido, NovoModelo,
} from "../../application/ports/DocumentoRepository";

const COLUNAS_MODELO = `
  id, orgao_id AS "orgaoId", modulo, tipo, escopo, nome, titulo, corpo, ativo,
  personalizado, updated_at AS "atualizadoEm"`;

const COLUNAS_EMITIDO = `
  id, orgao_id AS "orgaoId", modulo, tipo, codigo, titulo, corpo,
  referencia_id AS "referenciaId",
  emitido_por_nome AS "emitidoPorNome", emitido_por_cargo AS "emitidoPorCargo",
  data, cancelado_em AS "canceladoEm", cancelado_motivo AS "canceladoMotivo"`;

/**
 * Resolução global → prefeitura em uma consulta: a linha do órgão, quando
 * existe, ordena antes da global e o DISTINCT ON fica com ela. Fazer em dois
 * SELECTs abriria janela para o modelo trocar entre a leitura e o uso.
 */
const RESOLVIDOS = `
  SELECT DISTINCT ON (tipo) ${COLUNAS_MODELO},
         CASE WHEN orgao_id IS NULL THEN 'GLOBAL' ELSE 'PREFEITURA' END AS origem
    FROM documento_modelo
   WHERE (orgao_id = $1 OR orgao_id IS NULL)`;

const SQL = {
  resolverModelo: `${RESOLVIDOS} AND tipo = $2
     ORDER BY tipo, (orgao_id IS NULL)`,
  listarResolvidos: `
    SELECT * FROM (${RESOLVIDOS}
       AND ($2::text IS NULL OR modulo = $2)
     ORDER BY tipo, (orgao_id IS NULL)) AS resolvidos
     ORDER BY modulo, nome`,
  listarGlobais: `
    SELECT ${COLUNAS_MODELO} FROM documento_modelo
     WHERE orgao_id IS NULL ORDER BY modulo, nome`,
  buscarModelo: `SELECT ${COLUNAS_MODELO} FROM documento_modelo WHERE id = $1`,
  criarModelo: `
    INSERT INTO documento_modelo
      (orgao_id, modulo, tipo, escopo, nome, titulo, corpo, ativo, personalizado)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
  tipoEmUso: `
    SELECT 1 FROM documento_modelo
     WHERE tipo = $2 AND ($1::uuid IS NULL OR orgao_id = $1 OR orgao_id IS NULL)`,
  atualizarModelo: `
    UPDATE documento_modelo
       SET nome = $2, titulo = $3, corpo = $4, ativo = $5, updated_at = now()
     WHERE id = $1`,
  removerModelo: `DELETE FROM documento_modelo WHERE id = $1`,

  emitir: `
    INSERT INTO documento_emitido
      (orgao_id, modulo, tipo, codigo, titulo, corpo, dados, referencia_id,
       modelo_id, emitido_por_usuario_id, emitido_por_nome, emitido_por_cargo)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id`,
  buscarEmitido: `SELECT ${COLUNAS_EMITIDO} FROM documento_emitido WHERE orgao_id = $1 AND id = $2`,
  listarPorReferencia: `
    SELECT ${COLUNAS_EMITIDO} FROM documento_emitido
     WHERE orgao_id = $1 AND referencia_id = $2
     ORDER BY data DESC, id`,
  listarEmitidos: `
    SELECT ${COLUNAS_EMITIDO}, ${TOTAL_DA_JANELA} FROM documento_emitido
     WHERE orgao_id = $1
     ORDER BY data DESC, id
     LIMIT $2 OFFSET $3`,
  // Conferência pública: devolve só o que vai na tela, nunca `dados` — o
  // retrato guarda campos internos que ninguém de fora precisa ver.
  buscarPorCodigo: `
    SELECT d.codigo, d.titulo, d.corpo, d.data,
           d.emitido_por_nome AS "emitidoPorNome", d.emitido_por_cargo AS "emitidoPorCargo",
           o.nome AS "orgaoNome",
           d.cancelado_em AS "canceladoEm", d.cancelado_motivo AS "canceladoMotivo"
      FROM documento_emitido d
      JOIN orgao o ON o.id = d.orgao_id
     WHERE d.codigo = $1`,
  cancelar: `
    UPDATE documento_emitido
       SET cancelado_em = now(), cancelado_motivo = $3
     WHERE orgao_id = $1 AND id = $2 AND cancelado_em IS NULL`,
};

export class PostgresDocumentoRepository implements DocumentoRepository {
  resolverModelo = async (orgaoId: string, tipo: string): Promise<ModeloResolvido | null> => {
    const { rows } = await pool.query(SQL.resolverModelo, [orgaoId, tipo]);
    return rows[0] ?? null;
  };

  listarModelosResolvidos = async (
    orgaoId: string,
    modulo?: string,
  ): Promise<ModeloResolvido[]> => {
    const { rows } = await pool.query(SQL.listarResolvidos, [orgaoId, modulo ?? null]);
    return rows;
  };

  listarModelosGlobais = async (): Promise<ModeloDeDocumento[]> => {
    const { rows } = await pool.query(SQL.listarGlobais);
    return rows;
  };

  buscarModelo = async (id: string): Promise<ModeloDeDocumento | null> => {
    const { rows } = await pool.query(SQL.buscarModelo, [id]);
    return rows[0] ?? null;
  };

  criarModelo = async (dados: NovoModelo): Promise<string> => {
    const { rows } = await pool.query(SQL.criarModelo, [
      dados.orgaoId, dados.modulo, dados.tipo, dados.escopo,
      dados.nome, dados.titulo, dados.corpo, dados.ativo, dados.personalizado,
    ]);
    return rows[0].id;
  };

  tipoEmUso = async (orgaoId: string | null, tipo: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.tipoEmUso, [orgaoId, tipo]);
    return (rowCount ?? 0) > 0;
  };

  atualizarModelo = async (
    id: string,
    dados: Pick<NovoModelo, "nome" | "titulo" | "corpo" | "ativo">,
  ): Promise<void> => {
    await pool.query(SQL.atualizarModelo, [id, dados.nome, dados.titulo, dados.corpo, dados.ativo]);
  };

  removerModelo = async (id: string): Promise<void> => {
    await pool.query(SQL.removerModelo, [id]);
  };

  emitir = async (dados: NovoDocumentoEmitido): Promise<string> => {
    const { rows } = await pool.query(SQL.emitir, [
      dados.orgaoId, dados.modulo, dados.tipo, dados.codigo, dados.titulo, dados.corpo,
      JSON.stringify(dados.dados), dados.referenciaId, dados.modeloId,
      dados.emitidoPorUsuarioId, dados.emitidoPorNome, dados.emitidoPorCargo,
    ]);
    return rows[0].id;
  };

  buscarEmitido = async (orgaoId: string, id: string): Promise<DocumentoEmitido | null> => {
    const { rows } = await pool.query(SQL.buscarEmitido, [orgaoId, id]);
    return rows[0] ?? null;
  };

  listarPorReferencia = async (
    orgaoId: string,
    referenciaId: string,
  ): Promise<DocumentoEmitido[]> => {
    const { rows } = await pool.query(SQL.listarPorReferencia, [orgaoId, referenciaId]);
    return rows;
  };

  listarEmitidos = async (
    orgaoId: string,
    paginacao: Paginacao,
  ): Promise<Pagina<DocumentoEmitido>> => {
    const { rows } = await pool.query(SQL.listarEmitidos, [
      orgaoId, paginacao.porPagina, deslocamentoDe(paginacao),
    ]);
    return montarPagina(rows, paginacao);
  };

  buscarPorCodigo = async (codigo: string): Promise<DocumentoParaConferencia | null> => {
    const { rows } = await pool.query(SQL.buscarPorCodigo, [codigo]);
    return rows[0] ?? null;
  };

  cancelar = async (orgaoId: string, id: string, motivo: string): Promise<void> => {
    await pool.query(SQL.cancelar, [orgaoId, id, motivo]);
  };
}
