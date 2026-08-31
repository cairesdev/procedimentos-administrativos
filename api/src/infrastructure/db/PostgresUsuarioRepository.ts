import { pool } from "./pool";
import type {
  EdicaoUsuario, FluxoEtapaDestino, FluxoRepository, NovaLotacao, NovoUsuario, PerfilUsuario,
  UsuarioAutenticavel, UsuarioRepository, UsuarioResumo,
} from "../../application/ports/UsuarioRepository";

const SQL = {
  buscarPorIdentificador: `
    SELECT id, orgao_id AS "orgaoId", nome, email, username,
           senha_hash AS "senhaHash", papel_base AS "papelBase", ativo
      FROM usuario
     WHERE email = $1 OR username = $1`,
  existeEmail: `SELECT 1 FROM usuario WHERE email = $1`,
  existeUsername: `SELECT 1 FROM usuario WHERE username = $1`,
  criar: `
    INSERT INTO usuario (orgao_id, nome, email, username, senha_hash, papel_base)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
  criarLotacao: `
    INSERT INTO lotacao (usuario_id, unidade_id, setor_id, departamento_id, local_id)
    VALUES ($1, $2, $3, $4, $5) RETURNING id`,
  buscarPorId: `
    SELECT id, nome, email, papel_base AS "papelBase", ativo
      FROM usuario WHERE orgao_id = $1 AND id = $2`,
  atualizar: `
    UPDATE usuario
       SET nome = COALESCE($3, nome),
           email = COALESCE($4, email),
           papel_base = COALESCE($5, papel_base),
           senha_hash = COALESCE($6, senha_hash),
           ativo = COALESCE($7, ativo)
     WHERE orgao_id = $1 AND id = $2`,
  vinculos: `
    SELECT
      (SELECT count(*) FROM despacho WHERE usuario_id = $1) AS despachos,
      (SELECT count(*) FROM parecer WHERE usuario_id = $1) AS pareceres,
      (SELECT count(*) FROM auditoria_log WHERE usuario_id = $1) AS registros_de_auditoria`,
  remover: `DELETE FROM usuario WHERE orgao_id = $1 AND id = $2`,
  removerLotacoes: `DELETE FROM lotacao WHERE usuario_id = $1`,
  listar: `
    SELECT u.id, u.nome, u.email, u.papel_base AS "papelBase", u.ativo,
           lot.rotulo AS "lotacao", lot.valor AS "lotacaoValor"
      FROM usuario u
      -- A lotação decide o que a pessoa enxerga, e a lista não a mostrava:
      -- dava para trocar sem conferir onde ela estava. LATERAL porque
      -- interessa uma — a primeira, em ordem de nome, quando há mais de uma.
      LEFT JOIN LATERAL (
        SELECT coalesce(un.nome, s.nome, d.nome, lo.nome) AS rotulo,
               CASE
                 WHEN l.unidade_id IS NOT NULL THEN 'unidade:' || l.unidade_id
                 WHEN l.local_id   IS NOT NULL THEN 'escola:'  || l.local_id
                 ELSE 'setor:' || coalesce(l.setor_id, l.departamento_id)
               END AS valor
          FROM lotacao l
          LEFT JOIN unidade un ON un.id = l.unidade_id
          LEFT JOIN setor s ON s.id = l.setor_id
          LEFT JOIN departamento d ON d.id = l.departamento_id
          LEFT JOIN local lo ON lo.id = l.local_id
         WHERE l.usuario_id = u.id AND l.ativo
         ORDER BY rotulo
         LIMIT 1
      ) lot ON TRUE
     WHERE u.orgao_id = $1 ORDER BY u.nome`,
  perfil: `
    SELECT u.id, u.orgao_id AS "orgaoId", o.nome AS "orgaoNome",
           u.nome, u.email, u.username, u.papel_base AS "papelBase", u.ativo
      FROM usuario u
      JOIN orgao o ON o.id = u.orgao_id
     WHERE u.id = $1`,
  modulosDoOrgao: `
    SELECT modulo FROM orgao_modulo WHERE orgao_id = $1 AND ativo ORDER BY modulo`,
  // O tipo do setor vem junto: é ele que decide quais modelos de documento o
  // servidor alcança. Lotação em departamento herda o tipo do setor-pai —
  // quem está na "Divisão de Empenho" está, para todo efeito, em Compras.
  lotacoesDoUsuario: `
    SELECT l.id, l.unidade_id AS "unidadeId", l.setor_id AS "setorId",
           l.departamento_id AS "departamentoId", l.local_id AS "localId",
           coalesce(s.tipo, ds.tipo) AS "tipoSetor",
           coalesce(un.nome, d.nome, s.nome, lo.nome) AS destino
      FROM lotacao l
      LEFT JOIN unidade un ON un.id = l.unidade_id
      LEFT JOIN setor s ON s.id = l.setor_id
      LEFT JOIN departamento d ON d.id = l.departamento_id
      LEFT JOIN setor ds ON ds.id = d.setor_id
      LEFT JOIN local lo ON lo.id = l.local_id
     WHERE l.usuario_id = $1 AND l.ativo
     ORDER BY destino`,
  primeiraEtapa: `
    SELECT fe.setor_id AS "setorId", fe.departamento_id AS "departamentoId"
      FROM fluxo_etapa fe
      JOIN fluxo_configuracao fc ON fc.id = fe.fluxo_id
     WHERE fc.orgao_id = $1 AND fc.tipo_processo = $2
     ORDER BY fe.ordem
     LIMIT 1`,
  permiteOverride: `
    SELECT permite_override_usuario AS "permite"
      FROM fluxo_configuracao
     WHERE orgao_id = $1 AND tipo_processo = $2`,
};

export class PostgresUsuarioRepository implements UsuarioRepository, FluxoRepository {
  buscarPorIdentificador = async (identificador: string): Promise<UsuarioAutenticavel | null> => {
    const { rows } = await pool.query(SQL.buscarPorIdentificador, [identificador]);
    return rows[0] ?? null;
  };

  existeEmail = async (email: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.existeEmail, [email]);
    return (rowCount ?? 0) > 0;
  };

  existeUsername = async (username: string): Promise<boolean> => {
    const { rowCount } = await pool.query(SQL.existeUsername, [username]);
    return (rowCount ?? 0) > 0;
  };

  criar = async (dados: NovoUsuario): Promise<string> => {
    const { rows } = await pool.query(SQL.criar, [
      dados.orgaoId, dados.nome, dados.email, dados.username, dados.senhaHash, dados.papelBase,
    ]);
    return rows[0].id;
  };

  criarLotacao = async (dados: NovaLotacao): Promise<string> => {
    const { rows } = await pool.query(SQL.criarLotacao, [
      dados.usuarioId, dados.unidadeId ?? null, dados.setorId ?? null,
      dados.departamentoId ?? null, dados.localId ?? null,
    ]);
    return rows[0].id;
  };

  listar = async (orgaoId: string): Promise<UsuarioResumo[]> => {
    const { rows } = await pool.query(SQL.listar, [orgaoId]);
    return rows;
  };

  buscarPorId = async (orgaoId: string, id: string): Promise<UsuarioResumo | null> => {
    const { rows } = await pool.query(SQL.buscarPorId, [orgaoId, id]);
    return rows[0] ?? null;
  };

  atualizar = async (orgaoId: string, id: string, dados: EdicaoUsuario): Promise<void> => {
    await pool.query(SQL.atualizar, [
      orgaoId, id, dados.nome ?? null, dados.email ?? null,
      dados.papelBase ?? null, dados.senhaHash ?? null, dados.ativo ?? null,
    ]);
  };

  contarVinculos = async (id: string): Promise<Record<string, number>> => {
    const { rows } = await pool.query(SQL.vinculos, [id]);
    return Object.fromEntries(
      Object.entries(rows[0] as Record<string, string>)
        .map(([chave, valor]) => [chave, Number(valor)])
        .filter(([, quantidade]) => (quantidade as number) > 0),
    );
  };

  remover = async (orgaoId: string, id: string): Promise<void> => {
    await pool.query(SQL.remover, [orgaoId, id]);
  };

  removerLotacoes = async (usuarioId: string): Promise<void> => {
    await pool.query(SQL.removerLotacoes, [usuarioId]);
  };

  buscarPerfil = async (usuarioId: string): Promise<PerfilUsuario | null> => {
    const { rows } = await pool.query(SQL.perfil, [usuarioId]);
    if (!rows[0]) return null;
    const [lotacoes, modulos] = await Promise.all([
      pool.query(SQL.lotacoesDoUsuario, [usuarioId]),
      pool.query(SQL.modulosDoOrgao, [rows[0].orgaoId]),
    ]);
    return {
      ...rows[0],
      lotacoes: lotacoes.rows,
      modulos: modulos.rows.map((linha) => linha.modulo),
    };
  };

  primeiraEtapa = async (orgaoId: string, tipoProcesso: string): Promise<FluxoEtapaDestino | null> => {
    const { rows } = await pool.query(SQL.primeiraEtapa, [orgaoId, tipoProcesso]);
    return rows[0] ?? null;
  };

  permiteOverride = async (orgaoId: string, tipoProcesso: string): Promise<boolean> => {
    const { rows } = await pool.query(SQL.permiteOverride, [orgaoId, tipoProcesso]);
    return rows[0]?.permite === true;
  };
}
