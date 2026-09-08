import { pool } from "./pool";
import {
  montarPagina, TOTAL_DA_JANELA, deslocamentoDe,
} from "../../application/shared/Paginacao";
import type { Pagina, Paginacao } from "../../application/shared/Paginacao";
import type {
  EsperaCrua, FichaDoInscrito, InscritoNaLista, NovaIndicacao, NovaInscricao,
  NovaSessao, NovoMembro, Programa, ProgramaRepository, QuadroDaEquipe,
  SituacaoDaInscricao,
} from "../../application/ports/ProgramaRepository";

/**
 * O SQL do módulo de programas.
 *
 * **Nenhuma consulta aqui calcula média.** Elas trazem as linhas cruas — a
 * data da indicação, a do início, quantas sessões — e quem faz a conta é
 * `domain/programa/Espera.ts`, testado sem banco. Média no SQL seria uma
 * segunda implementação da mesma regra, e no dia em que divergissem a tela
 * diria um número e o ofício do Ministério Público diria outro.
 */

const INSCRITO = `
  i.id, i.paciente_id AS "pacienteId", p.prontuario, p.nome,
  to_char(p.data_nascimento, 'YYYY-MM-DD') AS "dataNascimento",
  i.situacao, to_char(i.inscrito_em, 'YYYY-MM-DD') AS "inscritoEm",
  to_char(i.diagnostico_em, 'YYYY-MM-DD') AS "diagnosticoEm", i.cid,
  (SELECT count(*) FROM indicacao d WHERE d.inscricao_id = i.id)::int
    AS "terapiasIndicadas",
  (SELECT count(*) FROM indicacao d
    WHERE d.inscricao_id = i.id AND d.iniciada_em IS NOT NULL)::int
    AS "terapiasIniciadas"`;

const MEMBRO = `
  pp.id, pp.usuario_id AS "usuarioId", u.nome, u.papel_base AS "papelBase",
  CASE WHEN u.conselho_numero IS NULL THEN NULL
       ELSE u.conselho_tipo || ' ' || u.conselho_numero || '/' || u.conselho_uf
  END AS conselho,
  pp.terapia_id AS "terapiaId", t.nome AS "terapiaNome",
  pp.carga_horaria_semanal AS "cargaHorariaSemanal",
  pp.horas_no_programa AS "horasNoPrograma",
  lo.nome AS "localNome", us.nome AS "unidadeSaudeNome",
  pp.tipo_vinculo AS "tipoVinculo",
  to_char(pp.iniciado_em, 'YYYY-MM-DD') AS "iniciadoEm",
  to_char(pp.encerrado_em, 'YYYY-MM-DD') AS "encerradoEm"`;

const SQL = {
  programas: `
    SELECT id, nome, sigla, descricao, ativo FROM programa
     WHERE orgao_id = $1
     ORDER BY ativo DESC, nome`,

  terapias: `
    SELECT t.id, t.programa_id AS "programaId", t.nome, t.conselho, t.ativo
      FROM terapia t
      JOIN programa pr ON pr.id = t.programa_id
     WHERE pr.orgao_id = $1
     ORDER BY t.nome`,

  criarPrograma: `
    INSERT INTO programa (orgao_id, nome, sigla, descricao)
    VALUES ($1, $2, $3, $4)
    RETURNING id`,

  atualizarPrograma: `
    UPDATE programa
       SET nome = $3, sigla = $4, descricao = $5, ativo = COALESCE($6, ativo)
     WHERE orgao_id = $1 AND id = $2
    RETURNING id`,

  /**
   * A terapia alcança a prefeitura pelo programa.
   *
   * O `SELECT` dentro do `INSERT` é o filtro por órgão: um id de programa de
   * outra prefeitura não devolve linha, e nada é gravado.
   */
  criarTerapia: `
    INSERT INTO terapia (programa_id, nome, conselho)
    SELECT pr.id, $3, $4 FROM programa pr
     WHERE pr.id = $2 AND pr.orgao_id = $1
    RETURNING id`,

  atualizarTerapia: `
    UPDATE terapia
       SET nome = $3, conselho = $4, ativo = $5
     WHERE id = $2
       AND EXISTS (SELECT 1 FROM programa pr
                    WHERE pr.id = terapia.programa_id AND pr.orgao_id = $1)
    RETURNING id`,

  listarInscritos: `
    SELECT ${INSCRITO}, ${TOTAL_DA_JANELA}
      FROM inscricao i
      JOIN paciente p ON p.id = i.paciente_id
     WHERE i.orgao_id = $1
       AND ($2::uuid IS NULL OR i.programa_id = $2)
       AND ($3::text IS NULL OR i.situacao = $3)
       AND ($4::text IS NULL
            OR p.nome ILIKE '%' || $4 || '%'
            OR p.prontuario::text = $4)
     ORDER BY p.nome, i.inscrito_em
     LIMIT $5 OFFSET $6`,

  inscricaoDoPaciente: `
    SELECT i.id, p.nome FROM inscricao i
      JOIN paciente p ON p.id = i.paciente_id
     WHERE i.orgao_id = $1 AND i.programa_id = $2 AND i.paciente_id = $3`,

  /**
   * O programa e o paciente entram por `SELECT`, e não como valores soltos.
   *
   * É o filtro por órgão das duas pontas: inscrever um paciente de outra
   * prefeitura, ou num programa de outra, não devolve linha.
   */
  inscrever: `
    INSERT INTO inscricao
      (orgao_id, programa_id, paciente_id, inscrito_em, situacao,
       diagnostico_em, cid, observacao, criado_por)
    SELECT $1, pr.id, p.id, COALESCE($4::date, current_date), $5, $6, $7, $8, $9
      FROM programa pr, paciente p
     WHERE pr.id = $2 AND pr.orgao_id = $1
       AND p.id = $3 AND p.orgao_id = $1
    RETURNING id`,

  fichaDoInscrito: `
    SELECT ${INSCRITO}, i.observacao, pr.nome AS "programaNome"
      FROM inscricao i
      JOIN paciente p ON p.id = i.paciente_id
      JOIN programa pr ON pr.id = i.programa_id
     WHERE i.orgao_id = $1 AND i.id = $2`,

  /**
   * As indicações da ficha, com as sessões dos últimos 90 dias.
   *
   * Noventa porque é a janela que a tela mostra por padrão; o relatório usa a
   * janela que o promotor pediu, e por isso tem consulta própria.
   */
  indicacoesDaFicha: `
    SELECT d.id, d.terapia_id AS "terapiaId", t.nome AS "terapiaNome",
           to_char(d.indicada_em, 'YYYY-MM-DD') AS "indicadaEm",
           d.periodicidade_semanal AS "periodicidadeSemanal",
           to_char(d.iniciada_em, 'YYYY-MM-DD') AS "iniciadaEm",
           to_char(d.encerrada_em, 'YYYY-MM-DD') AS "encerradaEm",
           d.motivo_encerramento AS "motivoEncerramento",
           (SELECT count(*) FROM sessao s
             WHERE s.indicacao_id = d.id AND s.compareceu
               AND s.data >= current_date - 90)::int AS "sessoesRecentes",
           (SELECT to_char(max(s.data), 'YYYY-MM-DD') FROM sessao s
             WHERE s.indicacao_id = d.id) AS "ultimaSessao"
      FROM indicacao d
      JOIN terapia t ON t.id = d.terapia_id
     WHERE d.inscricao_id = $1
     ORDER BY d.indicada_em`,

  atualizarInscricao: `
    UPDATE inscricao
       SET situacao = $3, diagnostico_em = $4, cid = $5,
           observacao = $6, encerrado_em = $7
     WHERE orgao_id = $1 AND id = $2
    RETURNING id`,

  /**
   * `ON CONFLICT DO NOTHING` contra o índice parcial da indicação viva.
   *
   * Indicar a mesma terapia sem encerrar a anterior colocaria a pessoa duas
   * vezes na mesma fila — e a fila é o número que está sendo investigado.
   * Voltar vazio é como o caso de uso sabe a diferença sem consultar antes.
   */
  indicar: `
    INSERT INTO indicacao
      (inscricao_id, terapia_id, indicada_em, periodicidade_semanal, indicada_por)
    SELECT i.id, t.id, COALESCE($4::date, current_date), $5, $6
      FROM inscricao i, terapia t
     WHERE i.id = $2 AND i.orgao_id = $1 AND t.id = $3
    ON CONFLICT DO NOTHING
    RETURNING id`,

  indicacaoAlcancavel: `
    SELECT d.inscricao_id AS "inscricaoId",
           to_char(d.iniciada_em, 'YYYY-MM-DD') AS "iniciadaEm"
      FROM indicacao d
      JOIN inscricao i ON i.id = d.inscricao_id
     WHERE d.id = $2 AND i.orgao_id = $1`,


  iniciarTerapia: `
    UPDATE indicacao
       SET iniciada_em = $3::date
     WHERE id = $2 AND iniciada_em IS NULL AND $3::date >= indicada_em
       AND EXISTS (SELECT 1 FROM inscricao i
                    WHERE i.id = indicacao.inscricao_id AND i.orgao_id = $1)
    RETURNING id`,

  encerrarTerapia: `
    UPDATE indicacao
       SET encerrada_em = $3::date, motivo_encerramento = $4
     WHERE id = $2 AND iniciada_em IS NOT NULL AND $3::date >= iniciada_em
       AND EXISTS (SELECT 1 FROM inscricao i
                    WHERE i.id = indicacao.inscricao_id AND i.orgao_id = $1)
    RETURNING id`,

  registrarSessao: `
    INSERT INTO sessao (indicacao_id, data, profissional_id, compareceu, observacao)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (indicacao_id, data) DO NOTHING
    RETURNING id`,

  sessoesDaIndicacao: `
    SELECT s.id, to_char(s.data, 'YYYY-MM-DD') AS data, u.nome AS profissional,
           s.compareceu, s.observacao
      FROM sessao s
      JOIN indicacao d ON d.id = s.indicacao_id
      JOIN inscricao i ON i.id = d.inscricao_id
      JOIN usuario u ON u.id = s.profissional_id
     WHERE s.indicacao_id = $2 AND i.orgao_id = $1
     ORDER BY s.data DESC
     LIMIT $3`,

  listarEquipe: `
    SELECT ${MEMBRO}
      FROM profissional_programa pp
      JOIN programa pr ON pr.id = pp.programa_id
      JOIN usuario u ON u.id = pp.usuario_id
      LEFT JOIN terapia t ON t.id = pp.terapia_id
      LEFT JOIN local lo ON lo.id = pp.local_id
      LEFT JOIN unidade_saude us ON us.id = pp.unidade_saude_id
     WHERE pr.orgao_id = $1 AND pp.programa_id = $2
     ORDER BY pp.encerrado_em NULLS FIRST, u.nome`,

  adicionarMembro: `
    INSERT INTO profissional_programa
      (programa_id, usuario_id, terapia_id, carga_horaria_semanal,
       horas_no_programa, local_id, unidade_saude_id, tipo_vinculo)
    SELECT pr.id, u.id, $4, $5, $6, $7, $8, $9
      FROM programa pr, usuario u
     WHERE pr.id = $2 AND pr.orgao_id = $1
       AND u.id = $3 AND u.orgao_id = $1
    ON CONFLICT DO NOTHING
    RETURNING id`,

  encerrarMembro: `
    UPDATE profissional_programa
       SET encerrado_em = $3::date
     WHERE id = $2 AND $3::date >= iniciado_em
       AND EXISTS (SELECT 1 FROM programa pr
                    WHERE pr.id = profissional_programa.programa_id
                      AND pr.orgao_id = $1)
    RETURNING id`,

  /**
   * As esperas cruas do relatório.
   *
   * Uma linha por indicação **viva ou iniciada**, com quantas sessões
   * compareceram na janela. As indicações encerradas ficam de fora: elas já
   * não descrevem a fila de hoje, e o ofício pergunta pela fila de hoje.
   */
  esperasDoPrograma: `
    SELECT d.terapia_id AS "terapiaId", t.nome AS "terapiaNome",
           to_char(d.indicada_em, 'YYYY-MM-DD') AS "indicadaEm",
           to_char(d.iniciada_em, 'YYYY-MM-DD') AS "iniciadaEm",
           d.periodicidade_semanal AS "periodicidadeSemanal",
           (SELECT count(*) FROM sessao s
             WHERE s.indicacao_id = d.id AND s.compareceu
               AND s.data >= $3::date)::int AS "sessoesComparecidas"
      FROM indicacao d
      JOIN terapia t ON t.id = d.terapia_id
      JOIN inscricao i ON i.id = d.inscricao_id
     WHERE i.orgao_id = $1 AND i.programa_id = $2
       AND d.encerrada_em IS NULL
       AND i.situacao IN ('EM_INVESTIGACAO', 'DIAGNOSTICADO')
     ORDER BY t.nome, d.indicada_em`,

  /**
   * As datas de nascimento de quem está ativo.
   *
   * Só as datas, porque a distribuição por faixa é do domínio: `GROUP BY` de
   * idade no SQL seria a segunda implementação da mesma regra, e a que erra
   * na criança de 3 anos e 364 dias.
   */
  nascimentosDosAtivos: `
    SELECT to_char(p.data_nascimento, 'YYYY-MM-DD') AS "nascimento"
      FROM inscricao i
      JOIN paciente p ON p.id = i.paciente_id
     WHERE i.orgao_id = $1 AND i.programa_id = $2
       AND i.situacao IN ('EM_INVESTIGACAO', 'DIAGNOSTICADO')`,

  criarRecorte: `
    INSERT INTO recorte_de_programa
      (orgao_id, programa_id, periodo_inicio, periodo_fim, criado_por)
    SELECT $1, pr.id, $3::date, $4::date, $5
      FROM programa pr
     WHERE pr.id = $2 AND pr.orgao_id = $1
    RETURNING id`,

  pessoasParaInscrever: `
    SELECT p.id, p.prontuario, p.nome,
           to_char(p.data_nascimento, 'YYYY-MM-DD') AS "dataNascimento"
      FROM paciente p
     WHERE p.orgao_id = $1
       AND (p.nome ILIKE '%' || $2 || '%'
            OR p.prontuario::text = $2
            OR p.cpf = $2 OR p.cns = $2)
     ORDER BY p.nome
     LIMIT 20`,

  profissionaisDoOrgao: `
    SELECT u.id, u.nome, u.papel_base AS "papelBase",
           CASE WHEN u.conselho_tipo IS NULL THEN NULL
                ELSE u.conselho_tipo || ' ' || u.conselho_numero || '/' || u.conselho_uf
           END AS conselho
      FROM usuario u
     WHERE u.orgao_id = $1 AND u.ativo = TRUE
       AND u.papel_base LIKE 'SAUDE%'
     ORDER BY u.nome`,

  acharRecorte: `
    SELECT r.id, r.programa_id AS "programaId", pr.nome AS "programaNome",
           to_char(r.periodo_inicio, 'YYYY-MM-DD') AS "desde",
           to_char(r.periodo_fim, 'YYYY-MM-DD') AS "ate",
           r.criado_em AS "criadoEm"
      FROM recorte_de_programa r
      JOIN programa pr ON pr.id = r.programa_id
     WHERE r.orgao_id = $1 AND r.id = $2`,

  contarPorSituacao: `
    SELECT situacao, count(*)::int AS quantidade
      FROM inscricao
     WHERE orgao_id = $1 AND programa_id = $2
     GROUP BY situacao
     ORDER BY situacao`,
};

export class PostgresProgramaRepository implements ProgramaRepository {
  listarProgramas = async (orgaoId: string): Promise<Programa[]> => {
    const [programas, terapias] = await Promise.all([
      pool.query(SQL.programas, [orgaoId]),
      pool.query(SQL.terapias, [orgaoId]),
    ]);
    return programas.rows.map((programa) => ({
      ...programa,
      terapias: terapias.rows
        .filter((terapia) => terapia.programaId === programa.id)
        .map(({ programaId: _ignorado, ...terapia }) => terapia),
    }));
  };

  criarPrograma = async (
    orgaoId: string,
    dados: { nome: string; sigla?: string | null; descricao?: string | null },
  ): Promise<string> => {
    const { rows } = await pool.query(SQL.criarPrograma, [
      orgaoId, dados.nome.trim(), dados.sigla?.trim() ?? null, dados.descricao ?? null,
    ]);
    return rows[0].id;
  };

  atualizarPrograma = async (
    orgaoId: string,
    id: string,
    dados: { nome: string; sigla?: string | null; descricao?: string | null; ativo?: boolean },
  ): Promise<boolean> => {
    const { rows } = await pool.query(SQL.atualizarPrograma, [
      orgaoId, id, dados.nome.trim(), dados.sigla?.trim() ?? null,
      dados.descricao ?? null, dados.ativo ?? null,
    ]);
    return rows.length > 0;
  };

  criarTerapia = async (
    orgaoId: string,
    programaId: string,
    dados: { nome: string; conselho?: string | null },
  ): Promise<string | null> => {
    const { rows } = await pool.query(SQL.criarTerapia, [
      orgaoId, programaId, dados.nome.trim(), dados.conselho ?? null,
    ]);
    return rows[0]?.id ?? null;
  };

  atualizarTerapia = async (
    orgaoId: string,
    terapiaId: string,
    dados: { nome: string; conselho?: string | null; ativo: boolean },
  ): Promise<boolean> => {
    const { rows } = await pool.query(SQL.atualizarTerapia, [
      orgaoId, terapiaId, dados.nome.trim(), dados.conselho ?? null, dados.ativo,
    ]);
    return rows.length > 0;
  };

  listarInscritos = async (
    orgaoId: string,
    filtros: Paginacao & { programaId?: string; situacao?: string; termo?: string },
  ): Promise<Pagina<InscritoNaLista>> => {
    const termo = filtros.termo?.trim();
    const { rows } = await pool.query(SQL.listarInscritos, [
      orgaoId,
      filtros.programaId ?? null,
      filtros.situacao ?? null,
      termo || null,
      filtros.porPagina,
      deslocamentoDe(filtros),
    ]);
    return montarPagina(rows, filtros);
  };

  inscricaoDoPaciente = async (
    orgaoId: string, programaId: string, pacienteId: string,
  ): Promise<{ id: string; nome: string } | null> => {
    const { rows } = await pool.query(SQL.inscricaoDoPaciente, [
      orgaoId, programaId, pacienteId,
    ]);
    return rows[0] ?? null;
  };

  inscrever = async (dados: NovaInscricao): Promise<string> => {
    const { rows } = await pool.query(SQL.inscrever, [
      dados.orgaoId,
      dados.programaId,
      dados.pacienteId,
      dados.inscritoEm ?? null,
      dados.situacao ?? "EM_INVESTIGACAO",
      dados.diagnosticoEm ?? null,
      dados.cid?.trim() ?? null,
      dados.observacao ?? null,
      dados.criadoPor,
    ]);
    return rows[0].id;
  };

  fichaDoInscrito = async (
    orgaoId: string, inscricaoId: string,
  ): Promise<FichaDoInscrito | null> => {
    const { rows } = await pool.query(SQL.fichaDoInscrito, [orgaoId, inscricaoId]);
    const inscricao = rows[0];
    if (!inscricao) return null;

    const { rows: indicacoes } = await pool.query(SQL.indicacoesDaFicha, [inscricaoId]);
    return { inscricao, indicacoes };
  };

  atualizarInscricao = async (
    orgaoId: string,
    inscricaoId: string,
    dados: {
      situacao: SituacaoDaInscricao;
      diagnosticoEm?: string | null;
      cid?: string | null;
      observacao?: string | null;
      encerradoEm?: string | null;
    },
  ): Promise<boolean> => {
    const { rows } = await pool.query(SQL.atualizarInscricao, [
      orgaoId,
      inscricaoId,
      dados.situacao,
      dados.diagnosticoEm ?? null,
      dados.cid?.trim() ?? null,
      dados.observacao ?? null,
      dados.encerradoEm ?? null,
    ]);
    return rows.length > 0;
  };

  indicar = async (orgaoId: string, dados: NovaIndicacao): Promise<string | null> => {
    const { rows } = await pool.query(SQL.indicar, [
      orgaoId,
      dados.inscricaoId,
      dados.terapiaId,
      dados.indicadaEm ?? null,
      dados.periodicidadeSemanal ?? null,
      dados.indicadaPor,
    ]);
    return rows[0]?.id ?? null;
  };

  indicacaoAlcancavel = async (
    orgaoId: string, indicacaoId: string,
  ): Promise<{ inscricaoId: string; iniciadaEm: string | null } | null> => {
    const { rows } = await pool.query(SQL.indicacaoAlcancavel, [orgaoId, indicacaoId]);
    return rows[0] ?? null;
  };

  iniciarTerapia = async (
    orgaoId: string, indicacaoId: string, em: string,
  ): Promise<boolean> => {
    const { rows } = await pool.query(SQL.iniciarTerapia, [orgaoId, indicacaoId, em]);
    return rows.length > 0;
  };

  encerrarTerapia = async (
    orgaoId: string, indicacaoId: string, em: string, motivo: string,
  ): Promise<boolean> => {
    const { rows } = await pool.query(SQL.encerrarTerapia, [
      orgaoId, indicacaoId, em, motivo,
    ]);
    return rows.length > 0;
  };

  /**
   * Devolve `null` quando o dia já tem sessão, em vez de estourar.
   *
   * O `UNIQUE (indicacao_id, data)` existe para pegar digitação repetida, e
   * chegava ao terapeuta como 500: erro de banco vazando pela rota. O caso de
   * uso transforma o `null` na frase que explica o que houve.
   */
  registrarSessao = async (dados: NovaSessao): Promise<string | null> => {
    const { rows } = await pool.query(SQL.registrarSessao, [
      dados.indicacaoId, dados.data, dados.profissionalId,
      dados.compareceu, dados.observacao?.trim() ?? null,
    ]);
    return rows[0]?.id ?? null;
  };

  sessoesDaIndicacao = async (orgaoId: string, indicacaoId: string, limite: number) => {
    const { rows } = await pool.query(SQL.sessoesDaIndicacao, [
      orgaoId, indicacaoId, limite,
    ]);
    return rows;
  };

  listarEquipe = async (orgaoId: string, programaId: string): Promise<QuadroDaEquipe> => {
    const { rows } = await pool.query(SQL.listarEquipe, [orgaoId, programaId]);
    return rows;
  };

  adicionarMembro = async (
    orgaoId: string, dados: NovoMembro,
  ): Promise<string | null> => {
    const { rows } = await pool.query(SQL.adicionarMembro, [
      orgaoId,
      dados.programaId,
      dados.usuarioId,
      dados.terapiaId ?? null,
      dados.cargaHorariaSemanal,
      dados.horasNoPrograma,
      dados.localId ?? null,
      dados.unidadeSaudeId ?? null,
      dados.tipoVinculo,
    ]);
    return rows[0]?.id ?? null;
  };

  encerrarMembro = async (
    orgaoId: string, membroId: string, em: string,
  ): Promise<boolean> => {
    const { rows } = await pool.query(SQL.encerrarMembro, [orgaoId, membroId, em]);
    return rows.length > 0;
  };

  esperasDoPrograma = async (
    orgaoId: string, programaId: string, desde: string,
  ): Promise<EsperaCrua[]> => {
    const { rows } = await pool.query(SQL.esperasDoPrograma, [orgaoId, programaId, desde]);
    return rows;
  };

  nascimentosDosAtivos = async (
    orgaoId: string, programaId: string,
  ): Promise<(string | null)[]> => {
    const { rows } = await pool.query(SQL.nascimentosDosAtivos, [orgaoId, programaId]);
    return rows.map((linha) => linha.nascimento);
  };

  contarPorSituacao = async (orgaoId: string, programaId: string) => {
    const { rows } = await pool.query(SQL.contarPorSituacao, [orgaoId, programaId]);
    return rows;
  };

  pessoasParaInscrever = async (orgaoId: string, termo: string) => {
    const { rows } = await pool.query(SQL.pessoasParaInscrever, [orgaoId, termo]);
    return rows;
  };

  profissionaisDoOrgao = async (orgaoId: string) => {
    const { rows } = await pool.query(SQL.profissionaisDoOrgao, [orgaoId]);
    return rows;
  };

  acharRecorte = async (orgaoId: string, id: string) => {
    const { rows } = await pool.query(SQL.acharRecorte, [orgaoId, id]);
    return rows[0] ?? null;
  };

  criarRecorte = async (
    orgaoId: string,
    dados: { programaId: string; desde: string; ate: string; criadoPor: string },
  ): Promise<string | null> => {
    const { rows } = await pool.query(SQL.criarRecorte, [
      orgaoId, dados.programaId, dados.desde, dados.ate, dados.criadoPor,
    ]);
    return rows[0]?.id ?? null;
  };
}
