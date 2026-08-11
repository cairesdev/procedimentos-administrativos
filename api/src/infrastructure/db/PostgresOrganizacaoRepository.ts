import { pool } from "./pool";
import type {
  DepartamentoResumo, EdicaoDepartamento, EdicaoSetor, EdicaoUnidade, NovaUnidade,
  NovoDepartamento, NovoSetor, SetorRepository, SetorResumo, UnidadeRepository, UnidadeResumo,
} from "../../application/ports/OrganizacaoRepository";

const SQL = {
  criarUnidade: `INSERT INTO unidade (orgao_id, nome, sigla) VALUES ($1, $2, $3) RETURNING id`,
  listarUnidades: `SELECT id, nome, sigla, ativo FROM unidade WHERE orgao_id = $1 ORDER BY nome`,
  buscarUnidade: `SELECT id, nome, sigla, ativo FROM unidade WHERE orgao_id = $1 AND id = $2`,
  atualizarUnidade: `
    UPDATE unidade
       SET nome = COALESCE($3, nome),
           sigla = CASE WHEN $4::boolean THEN $5 ELSE sigla END,
           ativo = COALESCE($6, ativo)
     WHERE orgao_id = $1 AND id = $2`,
  vinculosUnidade: `
    SELECT
      (SELECT count(*) FROM contrato_unidade cu
         JOIN contrato c ON c.id = cu.contrato_id
        WHERE cu.unidade_id = $2 AND c.orgao_id = $1) AS contratos,
      (SELECT count(*) FROM licitacao_unidade lu
         JOIN licitacao l ON l.id = lu.licitacao_id
        WHERE lu.unidade_id = $2 AND l.orgao_id = $1) AS licitacoes,
      (SELECT count(*) FROM solicitacao s
        WHERE s.unidade_solicitante_id = $2 AND s.orgao_id = $1) AS solicitacoes,
      (SELECT count(*) FROM lotacao WHERE unidade_id = $2) AS lotacoes,
      (SELECT count(*) FROM local WHERE unidade_id = $2 AND orgao_id = $1) AS locais`,
  removerUnidade: `DELETE FROM unidade WHERE orgao_id = $1 AND id = $2`,

  criarSetor: `INSERT INTO setor (orgao_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id`,
  listarSetores: `SELECT id, nome, tipo, ativo FROM setor WHERE orgao_id = $1 ORDER BY nome`,
  buscarSetor: `SELECT id, nome, tipo, ativo FROM setor WHERE orgao_id = $1 AND id = $2`,
  atualizarSetor: `
    UPDATE setor
       SET nome = COALESCE($3, nome), tipo = COALESCE($4, tipo), ativo = COALESCE($5, ativo)
     WHERE orgao_id = $1 AND id = $2`,
  vinculosSetor: `
    SELECT
      (SELECT count(*) FROM processo WHERE setor_atual_id = $2 AND orgao_id = $1) AS processos,
      (SELECT count(*) FROM despacho WHERE setor_id = $2) AS despachos,
      (SELECT count(*) FROM fluxo_etapa fe
         JOIN fluxo_configuracao fc ON fc.id = fe.fluxo_id
        WHERE fe.setor_id = $2 AND fc.orgao_id = $1) AS etapas_de_fluxo,
      (SELECT count(*) FROM lotacao WHERE setor_id = $2) AS lotacoes,
      (SELECT count(*) FROM departamento WHERE setor_id = $2) AS departamentos`,
  removerSetor: `DELETE FROM setor WHERE orgao_id = $1 AND id = $2`,
  setorDoOrgao: `SELECT 1 FROM setor WHERE id = $1 AND orgao_id = $2`,

  criarDepartamento: `
    INSERT INTO departamento (setor_id, nome, categoria_atendimento)
    VALUES ($1, $2, $3) RETURNING id`,
  listarDepartamentos: `
    SELECT id, nome, categoria_atendimento AS "categoriaAtendimento", ativo
      FROM departamento WHERE setor_id = $1 ORDER BY nome`,
  atualizarDepartamento: `
    UPDATE departamento
       SET nome = COALESCE($3, nome),
           categoria_atendimento = CASE WHEN $4::boolean THEN $5 ELSE categoria_atendimento END,
           ativo = COALESCE($6, ativo)
     WHERE setor_id = $1 AND id = $2`,
  vinculosDepartamento: `
    SELECT
      (SELECT count(*) FROM processo WHERE departamento_atual_id = $1) AS processos,
      (SELECT count(*) FROM despacho WHERE departamento_id = $1) AS despachos,
      (SELECT count(*) FROM fluxo_etapa WHERE departamento_id = $1) AS etapas_de_fluxo,
      (SELECT count(*) FROM lotacao WHERE departamento_id = $1) AS lotacoes`,
  removerDepartamento: `DELETE FROM departamento WHERE setor_id = $1 AND id = $2`,
};

// Converte a linha de contagens em objeto só com os vínculos existentes.
const vinculosNaoVazios = (linha: Record<string, string>): Record<string, number> =>
  Object.fromEntries(
    Object.entries(linha)
      .map(([chave, valor]) => [chave, Number(valor)])
      .filter(([, quantidade]) => (quantidade as number) > 0),
  );

export class PostgresOrganizacaoRepository implements UnidadeRepository, SetorRepository {
  criar = async (dados: NovaUnidade): Promise<string> => {
    const { rows } = await pool.query(SQL.criarUnidade, [dados.orgaoId, dados.nome, dados.sigla ?? null]);
    return rows[0].id;
  };

  listar = async (orgaoId: string): Promise<UnidadeResumo[]> => {
    const { rows } = await pool.query(SQL.listarUnidades, [orgaoId]);
    return rows;
  };

  buscar = async (orgaoId: string, id: string): Promise<UnidadeResumo | null> => {
    const { rows } = await pool.query(SQL.buscarUnidade, [orgaoId, id]);
    return rows[0] ?? null;
  };

  atualizar = async (orgaoId: string, id: string, dados: EdicaoUnidade): Promise<void> => {
    await pool.query(SQL.atualizarUnidade, [
      orgaoId, id, dados.nome ?? null,
      dados.sigla !== undefined, dados.sigla ?? null,
      dados.ativo ?? null,
    ]);
  };

  contarVinculos = async (orgaoId: string, id: string): Promise<Record<string, number>> => {
    const { rows } = await pool.query(SQL.vinculosUnidade, [orgaoId, id]);
    return vinculosNaoVazios(rows[0]);
  };

  remover = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.removerUnidade, [orgaoId, id]);
  };

  criarSetor = async (dados: NovoSetor): Promise<string> => {
    const { rows } = await pool.query(SQL.criarSetor, [dados.orgaoId, dados.nome, dados.tipo]);
    return rows[0].id;
  };

  listarSetores = async (orgaoId: string): Promise<SetorResumo[]> => {
    const { rows } = await pool.query(SQL.listarSetores, [orgaoId]);
    return rows;
  };

  buscarSetor = async (orgaoId: string, id: string): Promise<SetorResumo | null> => {
    const { rows } = await pool.query(SQL.buscarSetor, [orgaoId, id]);
    return rows[0] ?? null;
  };

  atualizarSetor = async (orgaoId: string, id: string, dados: EdicaoSetor): Promise<void> => {
    await pool.query(SQL.atualizarSetor, [
      orgaoId, id, dados.nome ?? null, dados.tipo ?? null, dados.ativo ?? null,
    ]);
  };

  contarVinculosSetor = async (orgaoId: string, id: string): Promise<Record<string, number>> => {
    const { rows } = await pool.query(SQL.vinculosSetor, [orgaoId, id]);
    return vinculosNaoVazios(rows[0]);
  };

  removerSetor = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.removerSetor, [orgaoId, id]);
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

  atualizarDepartamento = async (
    setorId: string, id: string, dados: EdicaoDepartamento,
  ): Promise<void> => {
    await pool.query(SQL.atualizarDepartamento, [
      setorId, id, dados.nome ?? null,
      dados.categoriaAtendimento !== undefined, dados.categoriaAtendimento ?? null,
      dados.ativo ?? null,
    ]);
  };

  contarVinculosDepartamento = async (id: string): Promise<Record<string, number>> => {
    const { rows } = await pool.query(SQL.vinculosDepartamento, [id]);
    return vinculosNaoVazios(rows[0]);
  };

  removerDepartamento = async (setorId: string, id: string): Promise<void> => {
    await pool.query(SQL.removerDepartamento, [setorId, id]);
  };
}
