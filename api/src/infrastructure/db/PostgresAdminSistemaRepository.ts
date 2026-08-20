import { pool } from "./pool";
import type {
  AdminAutenticavel, AdminDoSistema, AdministradorDaEntidade, AdminSistemaRepository, EdicaoOrgao,
  NovoAdminDoSistema, NovoOrgao, OrgaoResumo, TimbreDoOrgao,
} from "../../application/ports/AdminSistemaRepository";

const SQL = {
  adminPorEmail: `
    SELECT id, nome, email, senha_hash AS "senhaHash", ativo
      FROM admin_sistema WHERE email = $1`,
  buscarAdminPorId: `
    SELECT id, nome, email, ativo, created_at AS "criadoEm"
      FROM admin_sistema WHERE id = $1`,
  listarAdminsDoSistema: `
    SELECT id, nome, email, ativo, created_at AS "criadoEm"
      FROM admin_sistema
     ORDER BY ativo DESC, nome`,
  contarAdminsDoSistemaAtivos: `
    SELECT count(*) AS total FROM admin_sistema
     WHERE ativo AND ($1::uuid IS NULL OR id <> $1)`,
  criarAdminDoSistema: `
    INSERT INTO admin_sistema (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id`,
  atualizarAdminDoSistema: `
    UPDATE admin_sistema
       SET nome = COALESCE($2, nome),
           senha_hash = COALESCE($3, senha_hash),
           ativo = COALESCE($4, ativo)
     WHERE id = $1`,

  listarAdministradores: `
    SELECT id, nome, email, username, ativo, created_at AS "criadoEm"
      FROM usuario
     WHERE orgao_id = $1 AND papel_base = 'ADMIN'
     ORDER BY ativo DESC, nome`,
  contarAdministradoresAtivos: `
    SELECT count(*) AS total
      FROM usuario
     WHERE orgao_id = $1 AND papel_base = 'ADMIN' AND ativo
       AND ($2::uuid IS NULL OR id <> $2)`,
  listarOrgaos: `
    SELECT o.id, o.cnpj, o.nome, o.uf, o.municipio, o.endereco, o.ativo,
           coalesce(
             (SELECT array_agg(m.modulo ORDER BY m.modulo)
                FROM orgao_modulo m WHERE m.orgao_id = o.id AND m.ativo),
             '{}'
           ) AS modulos,
           (SELECT count(*) FROM usuario u WHERE u.orgao_id = o.id) AS usuarios
      FROM orgao o
     ORDER BY o.nome`,
  buscarOrgao: `
    SELECT o.id, o.cnpj, o.nome, o.uf, o.municipio, o.endereco, o.ativo,
           coalesce(
             (SELECT array_agg(m.modulo ORDER BY m.modulo)
                FROM orgao_modulo m WHERE m.orgao_id = o.id AND m.ativo),
             '{}'
           ) AS modulos,
           (SELECT count(*) FROM usuario u WHERE u.orgao_id = o.id) AS usuarios
      FROM orgao o WHERE o.id = $1`,
  existeCnpj: `SELECT 1 FROM orgao WHERE cnpj = $1 AND ($2::uuid IS NULL OR id <> $2)`,
  criarOrgao: `
    INSERT INTO orgao (cnpj, nome, uf, municipio, endereco)
    VALUES ($1, $2, $3, $4, $5) RETURNING id`,
  atualizarOrgao: `
    UPDATE orgao
       SET cnpj = COALESCE($2, cnpj),
           nome = COALESCE($3, nome),
           uf = COALESCE($4, uf),
           municipio = COALESCE($5, municipio),
           endereco = CASE WHEN $6::boolean THEN $7 ELSE endereco END,
           ativo = COALESCE($8, ativo)
     WHERE id = $1`,
  desativarModulos: `UPDATE orgao_modulo SET ativo = FALSE, data_desativacao = now() WHERE orgao_id = $1`,
  habilitarModulo: `
    INSERT INTO orgao_modulo (orgao_id, modulo, ativo, data_ativacao, data_desativacao)
    VALUES ($1, $2, TRUE, now(), NULL)
    ON CONFLICT (orgao_id, modulo)
    DO UPDATE SET ativo = TRUE, data_ativacao = now(), data_desativacao = NULL`,
  buscarTimbre: `
    SELECT arquivo_logomarca AS "arquivoLogomarca",
           cabecalho_timbre AS "cabecalhoTimbre",
           rodape_timbre AS "rodapeTimbre"
      FROM orgao_documento_config WHERE orgao_id = $1`,
  salvarTimbre: `
    INSERT INTO orgao_documento_config (orgao_id, arquivo_logomarca, cabecalho_timbre, rodape_timbre)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (orgao_id)
    DO UPDATE SET arquivo_logomarca = $2, cabecalho_timbre = $3, rodape_timbre = $4`,
};

const converter = (linha: Record<string, unknown>): OrgaoResumo => ({
  ...(linha as unknown as OrgaoResumo),
  usuarios: Number(linha.usuarios),
});

export class PostgresAdminSistemaRepository implements AdminSistemaRepository {
  buscarPorEmail = async (email: string): Promise<AdminAutenticavel | null> => {
    const { rows } = await pool.query(SQL.adminPorEmail, [email]);
    return rows[0] ?? null;
  };

  buscarAdminPorId = async (id: string): Promise<AdminDoSistema | null> => {
    const { rows } = await pool.query(SQL.buscarAdminPorId, [id]);
    return rows[0] ?? null;
  };

  listarAdminsDoSistema = async (): Promise<AdminDoSistema[]> => {
    const { rows } = await pool.query(SQL.listarAdminsDoSistema);
    return rows;
  };

  contarAdminsDoSistemaAtivos = async (ignorarId?: string): Promise<number> => {
    const { rows } = await pool.query(SQL.contarAdminsDoSistemaAtivos, [ignorarId ?? null]);
    return Number(rows[0].total);
  };

  criarAdminDoSistema = async (dados: NovoAdminDoSistema): Promise<string> => {
    const { rows } = await pool.query(SQL.criarAdminDoSistema, [
      dados.nome, dados.email, dados.senhaHash,
    ]);
    return rows[0].id;
  };

  atualizarAdminDoSistema = async (
    id: string,
    dados: { nome?: string; senhaHash?: string; ativo?: boolean },
  ): Promise<void> => {
    await pool.query(SQL.atualizarAdminDoSistema, [
      id, dados.nome ?? null, dados.senhaHash ?? null, dados.ativo ?? null,
    ]);
  };

  listarAdministradores = async (orgaoId: string): Promise<AdministradorDaEntidade[]> => {
    const { rows } = await pool.query(SQL.listarAdministradores, [orgaoId]);
    return rows;
  };

  contarAdministradoresAtivos = async (
    orgaoId: string,
    ignorarId?: string,
  ): Promise<number> => {
    const { rows } = await pool.query(SQL.contarAdministradoresAtivos, [
      orgaoId, ignorarId ?? null,
    ]);
    return Number(rows[0].total);
  };

  listarOrgaos = async (): Promise<OrgaoResumo[]> => {
    const { rows } = await pool.query(SQL.listarOrgaos);
    return rows.map(converter);
  };

  buscarOrgao = async (id: string): Promise<OrgaoResumo | null> => {
    const { rows } = await pool.query(SQL.buscarOrgao, [id]);
    return rows[0] ? converter(rows[0]) : null;
  };

  existeCnpj = async (cnpj: string, ignorarId?: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.existeCnpj, [cnpj, ignorarId ?? null]);
    return (rowCount ?? 0) > 0;
  };

  criarOrgao = async (dados: NovoOrgao): Promise<string> => {
    const { rows } = await pool.query(SQL.criarOrgao, [
      dados.cnpj, dados.nome, dados.uf, dados.municipio, dados.endereco ?? null,
    ]);
    return rows[0].id;
  };

  atualizarOrgao = async (id: string, dados: EdicaoOrgao): Promise<void> => {
    await pool.query(SQL.atualizarOrgao, [
      id, dados.cnpj ?? null, dados.nome ?? null, dados.uf ?? null, dados.municipio ?? null,
      dados.endereco !== undefined, dados.endereco ?? null, dados.ativo ?? null,
    ]);
  };

  // Desliga tudo e religa o que veio: o painel envia a lista final.
  definirModulos = async (orgaoId: string, modulos: string[]): Promise<void> => {
    await pool.query(SQL.desativarModulos, [orgaoId]);
    for (const modulo of modulos) {
      await pool.query(SQL.habilitarModulo, [orgaoId, modulo]);
    }
  };

  buscarTimbre = async (orgaoId: string): Promise<TimbreDoOrgao | null> => {
    const { rows } = await pool.query(SQL.buscarTimbre, [orgaoId]);
    return rows[0] ?? null;
  };

  salvarTimbre = async (orgaoId: string, dados: TimbreDoOrgao): Promise<void> => {
    await pool.query(SQL.salvarTimbre, [
      orgaoId, dados.arquivoLogomarca, dados.cabecalhoTimbre, dados.rodapeTimbre,
    ]);
  };
}
