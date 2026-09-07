import { Conflito, ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { ATOS, ATOS_QUE_EXIGEM_CONSELHO } from "../../domain/saude/AtosDaFicha";
import type { AtoDaFicha } from "../../domain/saude/AtosDaFicha";
import type {
  AtendimentoResumido, AtendimentoSaudeRepository,
} from "../ports/AtendimentoSaudeRepository";

/**
 * As quatro perguntas que toda escrita no prontuário responde antes de existir.
 *
 * Elas vivem juntas aqui, e não espalhadas por dez casos de uso, porque uma
 * delas esquecida num único lugar já é o defeito: prontuário aceita escrita de
 * outra prefeitura, ou aceita assinatura sem conselho, ou aceita alteração do
 * que já estava assinado. São exatamente os erros que ninguém percebe até
 * alguém pedir a ficha num processo.
 *
 * *Quem* pode escrever não é conferido aqui: isso é `exigirPermissao` na rota,
 * alimentado pela mesma tabela `ATOS`. Duplicar a checagem daria dois lugares
 * para discordarem.
 */

/** O resultado do exame e a retificação existem depois da alta, de propósito. */
const ATOS_DEPOIS_DA_ALTA: AtoDaFicha[] = ["RESULTADO_DE_EXAME", "RETIFICAR"];

/** Blocos que só existem uma vez por atendimento. */
const BLOCOS_UNICOS: AtoDaFicha[] = ["TRIAR", "AVALIAR", "DESFECHO"];

export type Autorizacao = {
  atendimento: AtendimentoResumido;
  /** "Dra. Ana Souza — CRM 12345/MA", pronto para ir impresso no bloco. */
  carimbo: string;
};

export class GuardaDaFicha {
  constructor(private readonly atendimentos: AtendimentoSaudeRepository) {}

  autorizar = async (
    orgaoId: string, atendimentoId: string, usuarioId: string, ato: AtoDaFicha,
  ): Promise<Autorizacao> => {
    // A trava do órgão. `resumo` filtra por `orgao_id` no SQL: um id de outra
    // prefeitura não é "sem permissão", é inexistente — e é assim que deve
    // parecer para quem tentou.
    const atendimento = await this.atendimentos.resumo(orgaoId, atendimentoId);
    if (!atendimento) throw new NaoEncontrado("Atendimento não encontrado");

    if (atendimento.status === "ENCERRADO" && !ATOS_DEPOIS_DA_ALTA.includes(ato)) {
      throw new ErroDeNegocio(
        `Este atendimento já foi encerrado. ${ATOS[ato].rotulo} não pode ser `
        + "registrado depois da saída do paciente — se for outra ocorrência, "
        + "abra um novo atendimento.",
      );
    }

    if (BLOCOS_UNICOS.includes(ato) && await this.atendimentos.blocoFechado(atendimentoId, ato)) {
      throw new Conflito(
        `${ATOS[ato].rotulo} já foi preenchido e assinado neste atendimento. `
        + "Registro clínico assinado não se altera — registre uma retificação.",
      );
    }

    const credencial = await this.atendimentos.credencialDoProfissional(orgaoId, usuarioId);
    if (!credencial) throw new NaoEncontrado("Profissional não encontrado neste órgão");

    if (ATOS_QUE_EXIGEM_CONSELHO.includes(ato) && !credencial.conselhoNumero) {
      /**
       * Sem conselho não há carimbo, e sem carimbo o bloco não vale nada.
       *
       * O erro precisa dizer o que fazer, porque quem esbarra nele é um médico
       * no meio do plantão, e a saída não está na tela em que ele está: é o
       * administrador que preenche CRM/COREN no cadastro.
       */
      throw new ErroDeNegocio(
        "Seu cadastro está sem o número do conselho profissional (CRM ou COREN). "
        + "Ele é o carimbo que vai impresso na ficha, e sem ele este registro "
        + "não pode ser assinado. Peça ao administrador para completar seu cadastro.",
      );
    }

    return { atendimento, carimbo: carimboDe(credencial) };
  };
}

export const carimboDe = (credencial: {
  nome: string;
  conselhoTipo: string | null;
  conselhoNumero: string | null;
  conselhoUf: string | null;
}): string => {
  if (!credencial.conselhoNumero) return credencial.nome;
  const uf = credencial.conselhoUf ? `/${credencial.conselhoUf}` : "";
  return `${credencial.nome} — ${credencial.conselhoTipo} ${credencial.conselhoNumero}${uf}`;
};
