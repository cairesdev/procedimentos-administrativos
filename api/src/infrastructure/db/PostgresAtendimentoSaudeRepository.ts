import { pool } from "./pool";
import {
  montarPagina, TOTAL_DA_JANELA, deslocamentoDe,
} from "../../application/shared/Paginacao";
import { lerFicha } from "./consultasDaFicha";
import { MESES_NA_SERIE_DE_TRABALHO } from "../../domain/saude/JanelaDoHistorico";
import type { Pagina } from "../../application/shared/Paginacao";
import type { Tx } from "../../application/ports/Transacao";
import type { AtoDaFicha } from "../../domain/saude/AtosDaFicha";
import type {
  AtendimentoNaLista, AtendimentoResumido, AtendimentoSaudeRepository,
  CredencialDoProfissional, Ficha, FiltroDeAtendimentos, Triagem,
} from "../../application/ports/AtendimentoSaudeRepository";

/**
 * O que a lista mostra de cada ficha.
 *
 * Os três `EXISTS` respondem à pergunta que o quadro da recepção faz: esta
 * ficha já passou pela triagem? já foi vista pelo médico? já saiu? É por eles
 * que o plantão sabe quem está esperando o quê, sem abrir uma por uma.
 */
const LINHA_DA_LISTA = `
  a.id, a.numero, a.status, a.paciente_id AS "pacienteId", a.aberto_em AS "abertoEm",
  p.nome AS "pacienteNome", p.prontuario,
  us.nome AS "unidadeSaudeNome",
  t.prioridade,
  (t.atendimento_id IS NOT NULL) AS "temTriagem",
  (av.atendimento_id IS NOT NULL) AS "temAvaliacao",
  d.tipo AS "desfechoTipo"`;

const DE_ONDE_VEM_A_LISTA = `
  FROM atendimento a
  JOIN unidade_saude us ON us.id = a.unidade_saude_id
  LEFT JOIN paciente p ON p.id = a.paciente_id
  LEFT JOIN triagem t ON t.atendimento_id = a.id
  LEFT JOIN avaliacao_medica av ON av.atendimento_id = a.id
  LEFT JOIN desfecho d ON d.atendimento_id = a.id`;

/** Qual coluna de fecho olhar para saber se o bloco já foi assinado. */
const TABELA_DO_BLOCO: Partial<Record<AtoDaFicha, string>> = {
  TRIAR: "triagem",
  AVALIAR: "avaliacao_medica",
  DESFECHO: "desfecho",
};

const SQL = {
  proximoNumero: `
    INSERT INTO numeracao_sequencia (orgao_id, tipo, ano, contador)
    VALUES ($1, 'ATENDIMENTO_SAUDE', $2, 1)
    ON CONFLICT (orgao_id, tipo, ano)
    DO UPDATE SET contador = numeracao_sequencia.contador + 1
    RETURNING contador`,

  /**
   * A unidade entra por `SELECT` e não por valor solto: é o filtro por órgão
   * na abertura. Uma unidade de saúde de outra prefeitura não devolve linha, e
   * a ficha não nasce.
   */
  abrir: `
    INSERT INTO atendimento (orgao_id, unidade_saude_id, numero, paciente_id, aberto_por)
    SELECT $1, us.id, $3, $4, $5 FROM unidade_saude us
     WHERE us.id = $2 AND us.orgao_id = $1
    RETURNING id`,

  resumo: `
    SELECT id, numero, status, paciente_id AS "pacienteId", aberto_em AS "abertoEm"
      FROM atendimento
     WHERE orgao_id = $1 AND id = $2`,

  /**
   * Só preenche o vazio, nunca troca.
   *
   * O `paciente_id IS NULL` no WHERE é a trava: trocar o paciente de uma ficha
   * já identificada moveria registro clínico de uma pessoa para outra, e
   * nenhuma tela deste sistema vai fazer isso.
   */
  identificar: `
    UPDATE atendimento a
       SET paciente_id = p.id
      FROM paciente p
     WHERE a.id = $2 AND a.orgao_id = $1 AND a.paciente_id IS NULL
       AND p.id = $3 AND p.orgao_id = $1
    RETURNING a.id`,

  credencial: `
    SELECT nome, conselho_tipo AS "conselhoTipo", conselho_numero AS "conselhoNumero",
           conselho_uf AS "conselhoUf"
      FROM usuario
     WHERE orgao_id = $1 AND id = $2 AND ativo`,

  /**
   * A lista do plantão.
   *
   * `$4` é o corte da série de trabalho — doze meses, calculado fora e
   * passado como parâmetro para a consulta não depender do relógio do banco.
   * Quem abre o histórico completo passa `null` e vê os vinte anos.
   *
   * A ordenação põe prioridade em cima, e depois o mais antigo primeiro: no
   * pronto atendimento quem chegou antes espera menos, e quem foi marcado como
   * prioridade não espera.
   */
  listar: `
    SELECT ${LINHA_DA_LISTA}, ${TOTAL_DA_JANELA}
    ${DE_ONDE_VEM_A_LISTA}
     WHERE a.orgao_id = $1
       AND ($2::text IS NULL OR a.status = $2)
       AND ($3::uuid IS NULL OR a.unidade_saude_id = $3)
       AND ($4::timestamptz IS NULL OR a.aberto_em >= $4)
       AND ($5::text IS NULL
            OR a.numero ILIKE '%' || $5 || '%'
            OR p.nome ILIKE '%' || $5 || '%'
            OR p.prontuario::text = $5)
     ORDER BY COALESCE(t.prioridade, FALSE) DESC, a.aberto_em, a.id
     LIMIT $6 OFFSET $7`,

  historico: `
    SELECT ${LINHA_DA_LISTA}
    ${DE_ONDE_VEM_A_LISTA}
     WHERE a.orgao_id = $1 AND a.paciente_id = $2
       AND ($3::timestamptz IS NULL OR a.aberto_em >= $3)
     ORDER BY a.aberto_em DESC`,

  /**
   * A triagem entra por `INSERT`, nunca por `UPDATE`.
   *
   * Ela nasce assinada — o enfermeiro preenche e fecha no mesmo ato. Um
   * rascunho editável de triagem seria sinal vital que muda de valor entre a
   * medição e a assinatura, que é a coisa que o gatilho da 0048 existe para
   * impedir.
   */
  salvarTriagem: `
    INSERT INTO triagem
      (atendimento_id, glicemia, pa_sistolica, pa_diastolica, pulso, saturacao,
       temperatura, queixa, conduta, prioridade, fechado_por, fechado_em)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())`,

  salvarAvaliacao: `
    INSERT INTO avaliacao_medica (atendimento_id, queixa_clinica, fechado_por, fechado_em)
    VALUES ($1, $2, $3, now())`,

  solicitarExame: `
    INSERT INTO exame (atendimento_id, descricao, solicitado_por)
    VALUES ($1, $2, $3)
    RETURNING id`,

  informarResultado: `
    UPDATE exame
       SET resultado = $3, resultado_por = $4, resultado_em = now()
     WHERE id = $2 AND atendimento_id = $1
    RETURNING id`,

  criarPrescricao: `
    INSERT INTO prescricao (atendimento_id, orientacoes, fechado_por, fechado_em)
    VALUES ($1, $2, $3, now())
    RETURNING id`,

  criarItem: `
    INSERT INTO prescricao_item
      (prescricao_id, medicamento, dose, via, frequencia, observacao)
    VALUES ($1, $2, $3, $4, $5, $6)`,

  /** O item alcança a prefeitura por dois joins: prescrição e atendimento. */
  itemAlcancavel: `
    SELECT a.id AS "atendimentoId"
      FROM prescricao_item i
      JOIN prescricao pr ON pr.id = i.prescricao_id
      JOIN atendimento a ON a.id = pr.atendimento_id
     WHERE i.id = $2 AND a.orgao_id = $1`,

  registrarAdministracao: `
    INSERT INTO administracao (prescricao_item_id, horario, executado_por, observacao)
    VALUES ($1, $2, $3, $4)
    RETURNING id`,

  registrarEvolucao: `
    INSERT INTO evolucao (atendimento_id, tipo, texto, fechado_por)
    VALUES ($1, $2, $3, $4)
    RETURNING id`,

  registrarProcedimento: `
    INSERT INTO procedimento (atendimento_id, tipo, descricao, executado_por)
    VALUES ($1, $2, $3, $4)
    RETURNING id`,

  registrarDesfecho: `
    INSERT INTO desfecho (atendimento_id, tipo, destino, horario, fechado_por)
    VALUES ($1, $2, $3, $4, $5)`,

  encerrar: `
    UPDATE atendimento SET status = 'ENCERRADO' WHERE id = $1`,

  registrarRetificacao: `
    INSERT INTO retificacao
      (atendimento_id, tabela_origem, registro_id, texto, autor_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id`,
};

/**
 * O bloco já foi assinado?
 *
 * A tabela varia com o ato, e por isso a consulta é montada — mas só a partir
 * de `TABELA_DO_BLOCO`, que é uma lista fechada no código. Nome de tabela
 * nunca vem do que o usuário mandou.
 */
const blocoFechadoSql = (tabela: string): string =>
  `SELECT 1 FROM ${tabela} WHERE atendimento_id = $1 LIMIT 1`;

const corteDaSerie = (incluirAntigos: boolean | undefined): Date | null => {
  if (incluirAntigos) return null;
  const corte = new Date();
  corte.setMonth(corte.getMonth() - MESES_NA_SERIE_DE_TRABALHO);
  return corte;
};

export class PostgresAtendimentoSaudeRepository implements AtendimentoSaudeRepository {
  proximoNumero = async (orgaoId: string, ano: number, tx: Tx): Promise<number> => {
    const { rows } = await tx.query(SQL.proximoNumero, [orgaoId, ano]);
    return Number(rows[0].contador);
  };

  abrir = async (
    dados: {
      orgaoId: string; unidadeSaudeId: string; numero: string;
      pacienteId: string | null; abertoPor: string;
    },
    tx: Tx,
  ): Promise<string> => {
    const { rows } = await tx.query(SQL.abrir, [
      dados.orgaoId, dados.unidadeSaudeId, dados.numero, dados.pacienteId, dados.abertoPor,
    ]);
    return rows[0].id;
  };

  resumo = async (
    orgaoId: string, atendimentoId: string,
  ): Promise<AtendimentoResumido | null> => {
    const { rows } = await pool.query(SQL.resumo, [orgaoId, atendimentoId]);
    return rows[0] ?? null;
  };

  identificar = async (
    orgaoId: string, atendimentoId: string, pacienteId: string,
  ): Promise<boolean> => {
    const { rows } = await pool.query(SQL.identificar, [orgaoId, atendimentoId, pacienteId]);
    return rows.length > 0;
  };

  credencialDoProfissional = async (
    orgaoId: string, usuarioId: string,
  ): Promise<CredencialDoProfissional | null> => {
    const { rows } = await pool.query(SQL.credencial, [orgaoId, usuarioId]);
    return rows[0] ?? null;
  };

  blocoFechado = async (atendimentoId: string, ato: AtoDaFicha): Promise<boolean> => {
    const tabela = TABELA_DO_BLOCO[ato];
    if (!tabela) return false;
    const { rows } = await pool.query(blocoFechadoSql(tabela), [atendimentoId]);
    return rows.length > 0;
  };

  listar = async (
    orgaoId: string, filtros: FiltroDeAtendimentos,
  ): Promise<Pagina<AtendimentoNaLista>> => {
    const termo = filtros.termo?.trim();
    const { rows } = await pool.query(SQL.listar, [
      orgaoId,
      filtros.status ?? null,
      filtros.unidadeSaudeId ?? null,
      corteDaSerie(filtros.incluirAntigos),
      termo || null,
      filtros.porPagina,
      deslocamentoDe(filtros),
    ]);
    return montarPagina(rows, filtros);
  };

  historicoDoPaciente = async (
    orgaoId: string, pacienteId: string, incluirAntigos: boolean,
  ): Promise<AtendimentoNaLista[]> => {
    const { rows } = await pool.query(SQL.historico, [
      orgaoId, pacienteId, corteDaSerie(incluirAntigos),
    ]);
    return rows;
  };

  ficha = (orgaoId: string, atendimentoId: string): Promise<Ficha | null> =>
    lerFicha(orgaoId, atendimentoId);

  salvarTriagem = async (
    atendimentoId: string,
    dados: Omit<Triagem, "fechadoPor" | "fechadoEm">,
    autorId: string,
  ): Promise<void> => {
    await pool.query(SQL.salvarTriagem, [
      atendimentoId,
      dados.glicemia,
      dados.paSistolica,
      dados.paDiastolica,
      dados.pulso,
      dados.saturacao,
      dados.temperatura,
      dados.queixa,
      dados.conduta,
      dados.prioridade,
      autorId,
    ]);
  };

  salvarAvaliacao = async (
    atendimentoId: string, queixaClinica: string, autorId: string,
  ): Promise<void> => {
    await pool.query(SQL.salvarAvaliacao, [atendimentoId, queixaClinica, autorId]);
  };

  solicitarExame = async (
    atendimentoId: string, descricao: string, autorId: string,
  ): Promise<string> => {
    const { rows } = await pool.query(SQL.solicitarExame, [
      atendimentoId, descricao, autorId,
    ]);
    return rows[0].id;
  };

  informarResultado = async (
    atendimentoId: string, exameId: string, resultado: string, autorId: string,
  ): Promise<boolean> => {
    const { rows } = await pool.query(SQL.informarResultado, [
      atendimentoId, exameId, resultado, autorId,
    ]);
    return rows.length > 0;
  };

  criarPrescricao = async (
    atendimentoId: string,
    dados: {
      orientacoes: string | null;
      itens: {
        medicamento: string; dose: string; via: string; frequencia: string;
        observacao?: string | null;
      }[];
    },
    autorId: string,
    tx: Tx,
  ): Promise<string> => {
    const { rows } = await tx.query(SQL.criarPrescricao, [
      atendimentoId, dados.orientacoes, autorId,
    ]);
    const prescricaoId = rows[0].id;

    // Prescrição e itens na mesma transação: cabeçalho assinado sem os
    // medicamentos seria uma receita em branco com carimbo de médico.
    for (const item of dados.itens) {
      await tx.query(SQL.criarItem, [
        prescricaoId,
        item.medicamento.trim(),
        item.dose.trim(),
        item.via,
        item.frequencia.trim(),
        item.observacao?.trim() ?? null,
      ]);
    }
    return prescricaoId;
  };

  itemAlcancavel = async (
    orgaoId: string, itemId: string,
  ): Promise<{ atendimentoId: string } | null> => {
    const { rows } = await pool.query(SQL.itemAlcancavel, [orgaoId, itemId]);
    return rows[0] ?? null;
  };

  registrarAdministracao = async (
    itemId: string,
    dados: { horario: Date; observacao?: string | null },
    autorId: string,
  ): Promise<string> => {
    const { rows } = await pool.query(SQL.registrarAdministracao, [
      itemId, dados.horario, autorId, dados.observacao?.trim() ?? null,
    ]);
    return rows[0].id;
  };

  registrarEvolucao = async (
    atendimentoId: string, tipo: "ENFERMAGEM" | "MEDICA", texto: string, autorId: string,
  ): Promise<string> => {
    const { rows } = await pool.query(SQL.registrarEvolucao, [
      atendimentoId, tipo, texto, autorId,
    ]);
    return rows[0].id;
  };

  registrarProcedimento = async (
    atendimentoId: string, tipo: string, descricao: string | null, autorId: string,
  ): Promise<string> => {
    const { rows } = await pool.query(SQL.registrarProcedimento, [
      atendimentoId, tipo, descricao, autorId,
    ]);
    return rows[0].id;
  };

  registrarDesfecho = async (
    atendimentoId: string,
    dados: { tipo: string; destino: string | null; horario: Date },
    autorId: string,
    tx: Tx,
  ): Promise<void> => {
    await tx.query(SQL.registrarDesfecho, [
      atendimentoId, dados.tipo, dados.destino, dados.horario, autorId,
    ]);
    // Na mesma transação, sempre: desfecho gravado com o atendimento ainda
    // aberto deixaria a ficha aceitando registro novo depois da alta.
    await tx.query(SQL.encerrar, [atendimentoId]);
  };

  registrarRetificacao = async (
    atendimentoId: string,
    dados: { tabelaOrigem: string; registroId: string; texto: string },
    autorId: string,
  ): Promise<string> => {
    const { rows } = await pool.query(SQL.registrarRetificacao, [
      atendimentoId, dados.tabelaOrigem, dados.registroId, dados.texto, autorId,
    ]);
    return rows[0].id;
  };
}
