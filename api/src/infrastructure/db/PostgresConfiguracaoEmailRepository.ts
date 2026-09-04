import { pool } from "./pool";
import type {
  ConfiguracaoDeEmail, ConfiguracaoEmailRepository, ConfiguracaoResolvida,
  DadosDaConfiguracao,
} from "../../application/ports/ConfiguracaoEmailRepository";

const COLUNAS = `
  id, orgao_id AS "orgaoId", host, porta, usuario,
  senha_cifrada AS "senhaCifrada", remetente,
  tls_direto AS "tlsDireto", ativo, atualizado_em AS "atualizadoEm"`;

const SQL = {
  /**
   * A da prefeitura vence a global, numa consulta só.
   *
   * Mesmo desenho do `resolverModelo`: as duas candidatas vêm juntas,
   * `orgao_id IS NULL` ordena depois, e o `LIMIT 1` fica com a da prefeitura
   * quando ela existe. Em dois SELECTs haveria janela para a configuração
   * mudar entre a leitura de uma e a da outra — e o e-mail sairia por um
   * servidor que já não é o configurado.
   *
   * **A consulta não filtra por `ativo`, de propósito.** Filtrar aqui faria a
   * prefeitura que desligou a sua cair na global — e desligar é dizer "não
   * quero mandar", não "mande por outro". A linha volta com o `ativo` e quem
   * decide é `EnviarEmail`, que precisa distinguir "não há configuração
   * nenhuma" de "há uma, desligada": as duas param o envio, e só a segunda
   * tem alguém para avisar.
   */
  resolver: `
    SELECT ${COLUNAS},
           CASE WHEN orgao_id IS NULL THEN 'GLOBAL' ELSE 'PREFEITURA' END AS origem
      FROM configuracao_email
     WHERE (orgao_id = $1 OR orgao_id IS NULL)
     ORDER BY (orgao_id IS NULL)
     LIMIT 1`,

  buscar: `
    SELECT ${COLUNAS} FROM configuracao_email
     WHERE ($1::uuid IS NULL AND orgao_id IS NULL) OR orgao_id = $1`,

  /**
   * Cria ou substitui.
   *
   * `senha_cifrada = COALESCE($5, senha_cifrada)` é o campo em branco do
   * formulário: quem entrou para corrigir a porta não pode sair sem senha.
   * Remover a autenticação é ato explícito, e passa por `limparSenha`.
   *
   * O `ON CONFLICT` mira os dois índices parciais — não há como declarar os
   * dois num `ON CONFLICT` só, então a escolha é feita antes, em `salvar`.
   */
  inserir: `
    INSERT INTO configuracao_email
      (orgao_id, host, porta, usuario, senha_cifrada, remetente, tls_direto, ativo,
       atualizado_em, atualizado_por)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9)`,

  atualizar: `
    UPDATE configuracao_email
       SET host = $2, porta = $3, usuario = $4,
           senha_cifrada = CASE WHEN $10 THEN $5 ELSE COALESCE($5, senha_cifrada) END,
           remetente = $6, tls_direto = $7, ativo = $8,
           atualizado_em = now(), atualizado_por = $9
     WHERE ($1::uuid IS NULL AND orgao_id IS NULL) OR orgao_id = $1`,

  remover: `
    DELETE FROM configuracao_email
     WHERE ($1::uuid IS NULL AND orgao_id IS NULL) OR orgao_id = $1`,
};

export class PostgresConfiguracaoEmailRepository implements ConfiguracaoEmailRepository {
  resolver = async (orgaoId: string): Promise<ConfiguracaoResolvida | null> => {
    const { rows } = await pool.query(SQL.resolver, [orgaoId]);
    return rows[0] ?? null;
  };

  buscar = async (orgaoId: string | null): Promise<ConfiguracaoDeEmail | null> => {
    const { rows } = await pool.query(SQL.buscar, [orgaoId]);
    return rows[0] ?? null;
  };

  salvar = async (
    orgaoId: string | null,
    dados: DadosDaConfiguracao,
    atualizadoPor: string,
  ): Promise<void> => {
    const existente = await this.buscar(orgaoId);

    // `undefined` = não mexer na senha; `null` = tirar a autenticação. O
    // booleano no fim é o que separa os dois dentro do SQL, que não distingue
    // "não passei" de "passei nulo".
    const limparSenha = dados.senhaCifrada === null;
    const senha = dados.senhaCifrada ?? null;

    /**
     * Os dois arrays são escritos por extenso, e não com `...comuns`.
     *
     * O guarda de `sql.test.ts` conta os itens no ponto da chamada e compara
     * com o maior `$N` da consulta — é o que pega parâmetro fora de ordem
     * antes de virar dado gravado na coluna errada. Um spread esconde a
     * contagem dele, e a repetição aqui é o preço de manter a conferência.
     */
    if (existente) {
      await pool.query(SQL.atualizar, [
        orgaoId, dados.host, dados.porta, dados.usuario ?? null, senha,
        dados.remetente, dados.tlsDireto, dados.ativo, atualizadoPor, limparSenha,
      ]);
      return;
    }

    await pool.query(SQL.inserir, [
      orgaoId, dados.host, dados.porta, dados.usuario ?? null, senha,
      dados.remetente, dados.tlsDireto, dados.ativo, atualizadoPor,
    ]);
  };

  remover = async (orgaoId: string | null): Promise<void> => {
    await pool.query(SQL.remover, [orgaoId]);
  };
}
