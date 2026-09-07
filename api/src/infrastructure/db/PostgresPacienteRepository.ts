import { pool } from "./pool";
import {
  montarPagina, TOTAL_DA_JANELA, deslocamentoDe,
} from "../../application/shared/Paginacao";
import type { Pagina, Paginacao } from "../../application/shared/Paginacao";
import type { Tx } from "../../application/ports/Transacao";
import type { DocumentosInformados } from "../../domain/saude/DocumentosDoPaciente";
import type {
  DadosDoPaciente, PacienteCompleto, PacienteNaLista, PacienteRepository,
} from "../../application/ports/PacienteRepository";

const RESUMO = `
  id, prontuario, nome, nome_mae AS "nomeMae",
  to_char(data_nascimento, 'YYYY-MM-DD') AS "dataNascimento",
  cns, cpf, telefone`;

const SQL = {
  /**
   * O prontuário não vira o ano.
   *
   * `ano = 0` é a convenção deste projeto para sequência vitalícia — protocolo
   * e processo reiniciam em janeiro, prontuário não pode: dois pacientes com o
   * número 1 desfariam justamente o que o número existe para fazer, que é
   * costurar a série histórica de uma pessoa.
   */
  proximoProntuario: `
    INSERT INTO numeracao_sequencia (orgao_id, tipo, ano, contador)
    VALUES ($1, 'PRONTUARIO', 0, 1)
    ON CONFLICT (orgao_id, tipo, ano)
    DO UPDATE SET contador = numeracao_sequencia.contador + 1
    RETURNING contador`,

  criar: `
    INSERT INTO paciente
      (orgao_id, prontuario, nome, nome_mae, data_nascimento, sexo,
       cns, cpf, nis, cnh, rg, endereco, cidade, uf, telefone, email, criado_por)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING id`,

  /**
   * Quem já esteve aqui, achado por qualquer um dos cinco documentos.
   *
   * Um `OR` por documento, cada um só valendo quando foi informado. Sem isto o
   * índice único devolveria erro de banco no meio do balcão, e a atendente
   * concluiria que o sistema quebrou em vez de abrir o cadastro existente.
   */
  porDocumento: `
    SELECT ${RESUMO} FROM paciente
     WHERE orgao_id = $1
       AND (($2::text IS NOT NULL AND cns = $2)
         OR ($3::text IS NOT NULL AND cpf = $3)
         OR ($4::text IS NOT NULL AND nis = $4)
         OR ($5::text IS NOT NULL AND cnh = $5)
         OR ($6::text IS NOT NULL AND rg  = $6))
     ORDER BY prontuario
     LIMIT 1`,

  porId: `
    SELECT ${RESUMO}, sexo, nis, cnh, rg, endereco, cidade, uf, email
      FROM paciente
     WHERE orgao_id = $1 AND id = $2`,

  condicoes: `
    SELECT c.id, c.tipo, c.descricao,
           u.nome AS "registradoPor", c.registrado_em AS "registradoEm"
      FROM paciente_condicao c
      LEFT JOIN usuario u ON u.id = c.registrado_por
     WHERE c.paciente_id = $1
     ORDER BY c.registrado_em DESC`,

  /**
   * A busca do balcão: nome, prontuário ou documento, tudo no mesmo campo.
   *
   * A atendente tem o paciente na frente e um papel na mão — pode ser o nome,
   * pode ser o cartão. Obrigá-la a escolher o campo antes de digitar é uma
   * pergunta a mais entre ela e o atendimento.
   */
  buscar: `
    SELECT ${RESUMO}, ${TOTAL_DA_JANELA} FROM paciente
     WHERE orgao_id = $1
       AND ($2::text IS NULL
            OR nome ILIKE '%' || $2 || '%'
            OR nome_mae ILIKE '%' || $2 || '%'
            OR cns = $3 OR cpf = $3 OR nis = $3 OR cnh = $3 OR rg = $3
            OR prontuario::text = $3)
     ORDER BY nome, prontuario
     LIMIT $4 OFFSET $5`,

  atualizar: `
    UPDATE paciente
       SET nome = $3, nome_mae = $4, data_nascimento = $5, sexo = $6,
           cns = $7, cpf = $8, nis = $9, cnh = $10, rg = $11,
           endereco = $12, cidade = $13, uf = $14, telefone = $15, email = $16
     WHERE orgao_id = $1 AND id = $2
    RETURNING id`,

  /**
   * A condição alcança a prefeitura por join no paciente.
   *
   * O `SELECT` dentro do `INSERT` é o que faz o filtro por órgão valer: um id
   * de paciente de outra prefeitura não devolve linha, e nada é gravado.
   */
  registrarCondicao: `
    INSERT INTO paciente_condicao (paciente_id, tipo, descricao, registrado_por)
    SELECT p.id, $3, $4, $5 FROM paciente p
     WHERE p.id = $2 AND p.orgao_id = $1
    RETURNING id`,

  /**
   * O `EXISTS` é o filtro por órgão — a condição não tem `orgao_id` própria e
   * alcança a prefeitura pelo paciente. Escrito como subconsulta, e não como
   * `DELETE ... USING`, porque o conferidor de sintaxe da suíte não lê `USING`
   * e a alternativa seria uma exceção na lista dele: exceção é onde um SQL
   * quebrado se esconde.
   */
  removerCondicao: `
    DELETE FROM paciente_condicao
     WHERE id = $3 AND paciente_id = $2
       AND EXISTS (SELECT 1 FROM paciente p WHERE p.id = $2 AND p.orgao_id = $1)
    RETURNING id`,
};

const documento = (
  documentos: DocumentosInformados, chave: "cns" | "cpf" | "nis" | "cnh" | "rg",
): string | null => documentos[chave] ?? null;

export class PostgresPacienteRepository implements PacienteRepository {
  proximoProntuario = async (orgaoId: string, tx: Tx): Promise<number> => {
    const { rows } = await tx.query(SQL.proximoProntuario, [orgaoId]);
    return Number(rows[0].contador);
  };

  criar = async (
    orgaoId: string, prontuario: number, dados: DadosDoPaciente, autorId: string, tx: Tx,
  ): Promise<string> => {
    const { rows } = await tx.query(SQL.criar, [
      orgaoId,
      prontuario,
      dados.nome.trim(),
      dados.nomeMae?.trim() ?? null,
      dados.dataNascimento ?? null,
      dados.sexo ?? null,
      documento(dados, "cns"),
      documento(dados, "cpf"),
      documento(dados, "nis"),
      documento(dados, "cnh"),
      documento(dados, "rg"),
      dados.endereco ?? null,
      dados.cidade ?? null,
      dados.uf ?? null,
      dados.telefone ?? null,
      dados.email ?? null,
      autorId,
    ]);
    return rows[0].id;
  };

  porDocumento = async (
    orgaoId: string, documentos: DocumentosInformados,
  ): Promise<PacienteNaLista | null> => {
    const informados = [
      documento(documentos, "cns"),
      documento(documentos, "cpf"),
      documento(documentos, "nis"),
      documento(documentos, "cnh"),
      documento(documentos, "rg"),
    ];
    // Sem nenhum documento não há o que conferir, e a consulta devolveria a
    // primeira linha da tabela.
    if (informados.every((valor) => valor === null)) return null;

    const { rows } = await pool.query(SQL.porDocumento, [
      orgaoId, informados[0], informados[1], informados[2], informados[3], informados[4],
    ]);
    return rows[0] ?? null;
  };

  porId = async (orgaoId: string, id: string): Promise<PacienteCompleto | null> => {
    const { rows } = await pool.query(SQL.porId, [orgaoId, id]);
    const paciente = rows[0];
    if (!paciente) return null;

    const { rows: condicoes } = await pool.query(SQL.condicoes, [id]);
    return { ...paciente, condicoes };
  };

  buscar = async (
    orgaoId: string, termo: string, paginacao: Paginacao,
  ): Promise<Pagina<PacienteNaLista>> => {
    const limpo = termo.trim();
    const { rows } = await pool.query(SQL.buscar, [
      orgaoId,
      limpo || null,
      limpo.replace(/\D/g, "") || limpo || null,
      paginacao.porPagina,
      deslocamentoDe(paginacao),
    ]);
    return montarPagina(rows, paginacao);
  };

  atualizar = async (
    orgaoId: string, id: string, dados: DadosDoPaciente,
  ): Promise<boolean> => {
    const { rows } = await pool.query(SQL.atualizar, [
      orgaoId,
      id,
      dados.nome.trim(),
      dados.nomeMae?.trim() ?? null,
      dados.dataNascimento ?? null,
      dados.sexo ?? null,
      documento(dados, "cns"),
      documento(dados, "cpf"),
      documento(dados, "nis"),
      documento(dados, "cnh"),
      documento(dados, "rg"),
      dados.endereco ?? null,
      dados.cidade ?? null,
      dados.uf ?? null,
      dados.telefone ?? null,
      dados.email ?? null,
    ]);
    return rows.length > 0;
  };

  registrarCondicao = async (
    orgaoId: string,
    pacienteId: string,
    condicao: { tipo: string; descricao?: string | null },
    autorId: string,
  ): Promise<string | null> => {
    const { rows } = await pool.query(SQL.registrarCondicao, [
      orgaoId, pacienteId, condicao.tipo, condicao.descricao?.trim() ?? null, autorId,
    ]);
    return rows[0]?.id ?? null;
  };

  removerCondicao = async (
    orgaoId: string, pacienteId: string, condicaoId: string,
  ): Promise<boolean> => {
    const { rows } = await pool.query(SQL.removerCondicao, [orgaoId, pacienteId, condicaoId]);
    return rows.length > 0;
  };
}
