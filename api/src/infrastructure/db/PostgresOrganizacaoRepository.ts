import { pool } from "./pool";
import type {
  DepartamentoResumo, NovaUnidade, NovoDepartamento, NovoSetor,
  SetorRepository, SetorResumo, UnidadeRepository, UnidadeResumo,
} from "../../application/ports/OrganizacaoRepository";

const SQL = {
  criarUnidade: `INSERT INTO unidade (orgao_id, nome, sigla) VALUES ($1, $2, $3) RETURNING id`,
  listarUnidades: `SELECT id, nome, sigla, ativo FROM unidade WHERE orgao_id = $1 ORDER BY nome`,
  criarSetor: `INSERT INTO setor (orgao_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id`,
  listarSetores: `SELECT id, nome, tipo, ativo FROM setor WHERE orgao_id = $1 ORDER BY nome`,
  setorDoOrgao: `SELECT 1 FROM setor WHERE id = $1 AND orgao_id = $2`,
  criarDepartamento: `
    INSERT INTO departamento (setor_id, nome, categoria_atendimento)
    VALUES ($1, $2, $3) RETURNING id`,
  listarDepartamentos: `
    SELECT id, nome, categoria_atendimento AS "categoriaAtendimento", ativo
      FROM departamento WHERE setor_id = $1 ORDER BY nome`,
};

export class PostgresOrganizacaoRepository implements UnidadeRepository, SetorRepository {
  criar = async (dados: NovaUnidade): Promise<string> => {
    const { rows } = await pool.query(SQL.criarUnidade, [dados.orgaoId, dados.nome, dados.sigla ?? null]);
    return rows[0].id;
  };

  listar = async (orgaoId: string): Promise<UnidadeResumo[]> => {
    const { rows } = await pool.query(SQL.listarUnidades, [orgaoId]);
    return rows;
  };

  criarSetor = async (dados: NovoSetor): Promise<string> => {
    const { rows } = await pool.query(SQL.criarSetor, [dados.orgaoId, dados.nome, dados.tipo]);
    return rows[0].id;
  };

  listarSetores = async (orgaoId: string): Promise<SetorResumo[]> => {
    const { rows } = await pool.query(SQL.listarSetores, [orgaoId]);
    return rows;
  };

  pertenceAoOrgao = async (setorId: string, orgaoId: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.setorDoOrgao, [setorId, orgaoId]);
    return (rowCount ?? 0) > 0;
  };

  criarDepartamento = async (dados: NovoDepartamento): Promise<string> => {
    const { rows } = await pool.query(SQL.criarDepartamento, [
      dados.setorId, dados.nome, dados.categoriaAtendimento ?? null,
    ]);
    return rows[0].id;
  };

  listarDepartamentos = async (setorId: string): Promise<DepartamentoResumo[]> => {
    const { rows } = await pool.query(SQL.listarDepartamentos, [setorId]);
    return rows;
  };
}
