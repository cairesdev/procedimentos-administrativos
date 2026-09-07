import { pool } from "./pool";
import type { Ficha } from "../../application/ports/AtendimentoSaudeRepository";

/**
 * A ficha inteira, montada para a tela e para a impressão.
 *
 * São nove consultas e não um join só, de propósito. A ficha é uma árvore —
 * prescrição tem itens, item tem administrações — e trazê-la em uma linha por
 * administração multiplicaria a queixa clínica e a evolução por cada horário
 * de remédio, para o código desmontar depois. Nove idas a um índice são
 * baratas; remontar cartesiano à mão é onde nascem os erros de contagem.
 *
 * Todas partem do atendimento **já filtrado por órgão**: a primeira consulta é
 * a trava, e as outras oito só rodam se ela devolveu linha.
 */

const SQL = {
  atendimento: `
    SELECT a.id, a.numero, a.status, a.aberto_em AS "abertoEm",
           a.paciente_id AS "pacienteId", a.unidade_saude_id AS "unidadeSaudeId",
           us.nome AS "unidadeSaudeNome",
           quem.nome AS "abertoPor",
           p.prontuario, p.nome AS "pacienteNome",
           t.prioridade,
           (t.atendimento_id IS NOT NULL) AS "temTriagem",
           (av.atendimento_id IS NOT NULL) AS "temAvaliacao",
           d.tipo AS "desfechoTipo"
      FROM atendimento a
      JOIN unidade_saude us ON us.id = a.unidade_saude_id
      JOIN usuario quem ON quem.id = a.aberto_por
      LEFT JOIN paciente p ON p.id = a.paciente_id
      LEFT JOIN triagem t ON t.atendimento_id = a.id
      LEFT JOIN avaliacao_medica av ON av.atendimento_id = a.id
      LEFT JOIN desfecho d ON d.atendimento_id = a.id
     WHERE a.orgao_id = $1 AND a.id = $2`,

  paciente: `
    SELECT id, prontuario, nome, nome_mae AS "nomeMae",
           to_char(data_nascimento, 'YYYY-MM-DD') AS "dataNascimento",
           cns, endereco, cidade, uf, telefone, email
      FROM paciente
     WHERE id = $1`,

  condicoes: `
    SELECT tipo, descricao FROM paciente_condicao
     WHERE paciente_id = $1
     ORDER BY registrado_em DESC`,

  /**
   * O nome de quem assinou vem junto do carimbo.
   *
   * A ficha impressa precisa dizer "Ana Souza — COREN 12345/MA" embaixo do
   * bloco, como o papel manda. Guardar só o id obrigaria a tela a resolver o
   * nome depois, e a impressão a fazer o mesmo.
   */
  triagem: `
    SELECT t.glicemia, t.pa_sistolica AS "paSistolica", t.pa_diastolica AS "paDiastolica",
           t.pulso, t.saturacao, t.temperatura, t.queixa, t.conduta, t.prioridade,
           u.nome AS "fechadoPor", t.fechado_em AS "fechadoEm"
      FROM triagem t
      LEFT JOIN usuario u ON u.id = t.fechado_por
     WHERE t.atendimento_id = $1`,

  avaliacao: `
    SELECT av.queixa_clinica AS "queixaClinica",
           u.nome AS "fechadoPor", av.fechado_em AS "fechadoEm"
      FROM avaliacao_medica av
      LEFT JOIN usuario u ON u.id = av.fechado_por
     WHERE av.atendimento_id = $1`,

  exames: `
    SELECT e.id, e.descricao, e.resultado,
           pediu.nome AS "solicitadoPor", e.solicitado_em AS "solicitadoEm",
           deu.nome AS "resultadoPor", e.resultado_em AS "resultadoEm"
      FROM exame e
      JOIN usuario pediu ON pediu.id = e.solicitado_por
      LEFT JOIN usuario deu ON deu.id = e.resultado_por
     WHERE e.atendimento_id = $1
     ORDER BY e.solicitado_em`,

  prescricoes: `
    SELECT pr.id, pr.orientacoes,
           u.nome AS "fechadoPor", pr.fechado_em AS "fechadoEm"
      FROM prescricao pr
      LEFT JOIN usuario u ON u.id = pr.fechado_por
     WHERE pr.atendimento_id = $1
     ORDER BY pr.criado_em`,

  itens: `
    SELECT i.id, i.prescricao_id AS "prescricaoId", i.medicamento, i.dose, i.via,
           i.frequencia, i.observacao
      FROM prescricao_item i
      JOIN prescricao pr ON pr.id = i.prescricao_id
     WHERE pr.atendimento_id = $1
     ORDER BY i.medicamento`,

  administracoes: `
    SELECT ad.id, ad.prescricao_item_id AS "itemId", ad.horario,
           u.nome AS "executadoPor", ad.observacao
      FROM administracao ad
      JOIN prescricao_item i ON i.id = ad.prescricao_item_id
      JOIN prescricao pr ON pr.id = i.prescricao_id
      JOIN usuario u ON u.id = ad.executado_por
     WHERE pr.atendimento_id = $1
     ORDER BY ad.horario`,

  evolucoes: `
    SELECT e.id, e.tipo, e.texto, u.nome AS "autor", e.fechado_em AS "fechadoEm"
      FROM evolucao e
      JOIN usuario u ON u.id = e.fechado_por
     WHERE e.atendimento_id = $1
     ORDER BY e.fechado_em`,

  procedimentos: `
    SELECT pc.id, pc.tipo, pc.descricao, u.nome AS "autor",
           pc.executado_em AS "executadoEm"
      FROM procedimento pc
      JOIN usuario u ON u.id = pc.executado_por
     WHERE pc.atendimento_id = $1
     ORDER BY pc.executado_em`,

  desfecho: `
    SELECT d.tipo, d.destino, d.horario,
           u.nome AS "fechadoPor", d.fechado_em AS "fechadoEm"
      FROM desfecho d
      JOIN usuario u ON u.id = d.fechado_por
     WHERE d.atendimento_id = $1`,

  retificacoes: `
    SELECT r.id, r.tabela_origem AS "tabelaOrigem", r.registro_id AS "registroId",
           r.texto, u.nome AS "autor", r.criado_em AS "criadoEm"
      FROM retificacao r
      JOIN usuario u ON u.id = r.autor_id
     WHERE r.atendimento_id = $1
     ORDER BY r.criado_em`,
};

export const lerFicha = async (
  orgaoId: string, atendimentoId: string,
): Promise<Ficha | null> => {
  const { rows: cabecalho } = await pool.query(SQL.atendimento, [orgaoId, atendimentoId]);
  const atendimento = cabecalho[0];
  if (!atendimento) return null;

  const [
    triagem, avaliacao, exames, prescricoes, itens, administracoes,
    evolucoes, procedimentos, desfecho, retificacoes,
  ] = await Promise.all([
    pool.query(SQL.triagem, [atendimentoId]),
    pool.query(SQL.avaliacao, [atendimentoId]),
    pool.query(SQL.exames, [atendimentoId]),
    pool.query(SQL.prescricoes, [atendimentoId]),
    pool.query(SQL.itens, [atendimentoId]),
    pool.query(SQL.administracoes, [atendimentoId]),
    pool.query(SQL.evolucoes, [atendimentoId]),
    pool.query(SQL.procedimentos, [atendimentoId]),
    pool.query(SQL.desfecho, [atendimentoId]),
    pool.query(SQL.retificacoes, [atendimentoId]),
  ]);

  let paciente: Ficha["paciente"] = null;
  if (atendimento.pacienteId) {
    const { rows } = await pool.query(SQL.paciente, [atendimento.pacienteId]);
    if (rows[0]) {
      const { rows: condicoes } = await pool.query(SQL.condicoes, [atendimento.pacienteId]);
      paciente = { ...rows[0], condicoes };
    }
  }

  const administracoesPorItem = new Map<string, typeof administracoes.rows>();
  for (const linha of administracoes.rows) {
    const lista = administracoesPorItem.get(linha.itemId) ?? [];
    lista.push(linha);
    administracoesPorItem.set(linha.itemId, lista);
  }

  return {
    atendimento,
    paciente,
    triagem: triagem.rows[0] ?? null,
    avaliacao: avaliacao.rows[0] ?? null,
    exames: exames.rows,
    prescricoes: prescricoes.rows.map((prescricao) => ({
      ...prescricao,
      itens: itens.rows
        .filter((item) => item.prescricaoId === prescricao.id)
        .map((item) => ({
          ...item,
          administracoes: administracoesPorItem.get(item.id) ?? [],
        })),
    })),
    evolucoes: evolucoes.rows,
    procedimentos: procedimentos.rows,
    desfecho: desfecho.rows[0] ?? null,
    retificacoes: retificacoes.rows,
  };
};
