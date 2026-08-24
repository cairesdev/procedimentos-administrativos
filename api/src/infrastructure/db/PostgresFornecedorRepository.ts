import { pool } from "./pool";
import {
  montarPagina, TOTAL_DA_JANELA, deslocamentoDe,
  type Pagina, type Paginacao,
} from "../../application/shared/Paginacao";
import type {
  DadosFornecedor, FornecedorCompleto, FornecedorRepository,
} from "../../application/ports/FornecedorRepository";

const COLUNAS = `
  id, documento, razao_social AS "razaoSocial", endereco, email, telefone,
  inscricao_estadual AS "inscricaoEstadual", inscricao_municipal AS "inscricaoMunicipal"`;

const SQL = {
  porDocumento: `SELECT ${COLUNAS} FROM fornecedor WHERE documento = $1`,
  porId: `SELECT ${COLUNAS} FROM fornecedor WHERE id = $1`,
  criar: `
    INSERT INTO fornecedor (documento, razao_social, endereco, email, telefone,
                            inscricao_estadual, inscricao_municipal)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
  registrarHistorico: `
    INSERT INTO fornecedor_historico (fornecedor_id, alterado_por, dados_anteriores)
    VALUES ($1, $2, $3)`,
  atualizar: `
    UPDATE fornecedor SET
      razao_social = COALESCE($2, razao_social),
      endereco = COALESCE($3, endereco),
      email = COALESCE($4, email),
      telefone = COALESCE($5, telefone),
      inscricao_estadual = COALESCE($6, inscricao_estadual),
      inscricao_municipal = COALESCE($7, inscricao_municipal)
    WHERE id = $1`,
  listar: `
    SELECT ${COLUNAS}, ${TOTAL_DA_JANELA} FROM fornecedor
     WHERE $1::text IS NULL
        OR documento LIKE $1 || '%'
        OR upper(razao_social) LIKE '%' || upper($1) || '%'
     ORDER BY razao_social, id
     LIMIT $2 OFFSET $3`,
};

export class PostgresFornecedorRepository implements FornecedorRepository {
  buscarPorDocumento = async (documento: string): Promise<FornecedorCompleto | null> => {
    const { rows } = await pool.query(SQL.porDocumento, [documento]);
    return rows[0] ?? null;
  };

  buscarPorId = async (id: string): Promise<FornecedorCompleto | null> => {
    const { rows } = await pool.query(SQL.porId, [id]);
    return rows[0] ?? null;
  };

  criar = async (dados: DadosFornecedor): Promise<string> => {
    const { rows } = await pool.query(SQL.criar, [
      dados.documento, dados.razaoSocial, dados.endereco ?? null, dados.email ?? null,
      dados.telefone ?? null, dados.inscricaoEstadual ?? null, dados.inscricaoMunicipal ?? null,
    ]);
    return rows[0].id;
  };

  atualizar = async (id: string, dados: Partial<DadosFornecedor>, alteradoPor: string): Promise<void> => {
    const atual = await this.buscarPorId(id);
    await pool.query(SQL.registrarHistorico, [id, alteradoPor, JSON.stringify(atual)]);
    await pool.query(SQL.atualizar, [
      id, dados.razaoSocial ?? null, dados.endereco ?? null, dados.email ?? null,
      dados.telefone ?? null, dados.inscricaoEstadual ?? null, dados.inscricaoMunicipal ?? null,
    ]);
  };

  listar = async (
    paginacao: Paginacao,
    busca?: string,
  ): Promise<Pagina<FornecedorCompleto>> => {
    const { rows } = await pool.query(SQL.listar, [
      busca ?? null, paginacao.porPagina, deslocamentoDe(paginacao),
    ]);
    return montarPagina(rows, paginacao);
  };
}
