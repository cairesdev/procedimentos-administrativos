import assert from "node:assert/strict";
import { ErroDeNegocio } from "../../src/domain/shared/ErroDeNegocio";
import type { Tx } from "../../src/application/ports/Transacao";

/**
 * Repositórios falsos e utilidades dos testes de caso de uso.
 *
 * A regra que vale para todos: o falso guarda o que foi gravado, e o teste que
 * espera recusa confere que nada entrou. Caso de uso que valida e grava pela
 * metade é pior que caso de uso sem validação — o estado quebrado sobrevive à
 * correção do código.
 */

/** Espera a rejeição e confere a mensagem (e o status, quando importa). */
export const recusa = async (
  acao: () => Promise<unknown>,
  trecho: RegExp,
  status?: number,
): Promise<void> => {
  try {
    await acao();
    assert.fail(`deveria recusar: ${trecho}`);
  } catch (erro) {
    assert.ok(erro instanceof ErroDeNegocio, `erro inesperado: ${String(erro)}`);
    assert.match((erro as Error).message, trecho);
    if (status !== undefined) assert.equal((erro as ErroDeNegocio).status, status);
  }
};

/** Transação de mentira: executa o corpo com um `Tx` que não faz nada. */
export const semTransacao = async <T>(corpo: (tx: Tx) => Promise<T>): Promise<T> =>
  corpo({ query: async () => ({ rows: [] }) } as unknown as Tx);

/** Auditoria falsa que só acumula o que foi registrado. */
export const auditoriaFalsa = () => {
  const registros: Record<string, unknown>[] = [];
  return {
    registros,
    porta: {
      registrar: async (evento: Record<string, unknown>) => {
        registros.push(evento);
      },
    },
  };
};

/** CPF e CNPJ válidos pela regra dos dígitos — não pertencem a ninguém. */
export const CPF_VALIDO = "52998224725";
export const CNPJ_VALIDO = "11222333000181";
export const CPF_INVALIDO = "52998224724";
