import { enderecoValido } from "../../domain/email/Remetente";
import type { MensagemPronta, TipoDeEmail } from "../../domain/email/Mensagens";
import type { EmailFilaRepository } from "../ports/EmailFilaRepository";
import type { Tx } from "../ports/Transacao";

export type PedidoDeEmail = {
  orgaoId: string;
  tipo: TipoDeEmail;
  destinatario: string | null | undefined;
  mensagem: MensagemPronta;
  referenciaId?: string | null;
  /**
   * O que identifica o ato — `EXIGENCIA:<id>`, `CONVITE_FORNECEDOR:<id>`.
   * É o que impede o duplo clique de virar dois e-mails.
   */
  chave: string;
};

/**
 * Põe o e-mail na fila, dentro da transação do ato que o gerou.
 *
 * **Nunca lança.** É a regra que dá sentido a esta fatia: o e-mail é um aviso
 * sobre o ato, não o ato. Uma exigência não pode deixar de ser registrada
 * porque o requerente digitou o e-mail errado no balcão, nem porque a coluna
 * de destinatário está vazia — o processo continua, e o link continua na tela
 * para quem precisar mandar à mão.
 *
 * O que ele devolve conta o que aconteceu, e serve para o chamador decidir se
 * avisa alguma coisa na tela:
 *
 * - `enfileirado` — está na fila, o worker leva daqui.
 * - `sem-endereco` — não há para quem mandar. O caso comum: convite de
 *   checklist para um engenheiro cujo e-mail ninguém cadastrou.
 * - `endereco-invalido` — há algo no campo, e não é endereço. Erro de
 *   digitação, e vale dizer na tela: é a única chance de alguém corrigir.
 * - `repetido` — a chave já existia. Segundo clique, e não erro.
 */
export type ResultadoDoEnfileiramento =
  | "enfileirado"
  | "sem-endereco"
  | "endereco-invalido"
  | "repetido";

export class EnfileirarEmail {
  constructor(private readonly fila: EmailFilaRepository) {}

  executar = async (tx: Tx, pedido: PedidoDeEmail): Promise<ResultadoDoEnfileiramento> => {
    const destinatario = (pedido.destinatario ?? "").trim();
    if (!destinatario) return "sem-endereco";

    /**
     * O endereço é conferido aqui, e não na quinta tentativa de entrega.
     *
     * Um nome digitado no campo de e-mail nunca vira entrega: ficaria cinco
     * rodadas ocupando o worker, para terminar em FALHOU com uma mensagem do
     * servidor SMTP que não diz "alguém digitou errado". Barrar na entrada é o
     * que transforma isso num aviso corrigível.
     */
    if (!enderecoValido(destinatario)) return "endereco-invalido";

    const entrou = await this.fila.enfileirar(tx, {
      orgaoId: pedido.orgaoId,
      tipo: pedido.tipo,
      destinatario,
      assunto: pedido.mensagem.assunto,
      corpo: pedido.mensagem.corpo,
      referenciaId: pedido.referenciaId ?? null,
      chaveIdempotencia: pedido.chave,
    });

    return entrou ? "enfileirado" : "repetido";
  };
}
