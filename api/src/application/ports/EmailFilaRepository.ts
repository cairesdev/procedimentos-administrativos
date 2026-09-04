import type { Pagina, Paginacao } from "../shared/Paginacao";
import type { Tx } from "./Transacao";
import type { TipoDeEmail } from "../../domain/email/Mensagens";

export type StatusDoEmail = "PENDENTE" | "ENVIADO" | "FALHOU";

export type EmailNaFila = {
  id: string;
  orgaoId: string;
  tipo: TipoDeEmail;
  destinatario: string;
  assunto: string;
  corpo: string;
  referenciaId: string | null;
  status: StatusDoEmail;
  tentativas: number;
  ultimoErro: string | null;
  agendadoPara: string;
  enviadoEm: string | null;
  criadoEm: string;
};

/** O que o worker precisa saber para mandar — mais o nome que vai no remetente. */
export type EmailParaEnviar = EmailNaFila & { orgaoNome: string };

export type NovoEmail = {
  orgaoId: string;
  tipo: TipoDeEmail;
  destinatario: string;
  assunto: string;
  corpo: string;
  referenciaId?: string | null;
  chaveIdempotencia: string;
};

export interface EmailFilaRepository {
  /**
   * Enfileira dentro da transação do ato que gerou o e-mail.
   *
   * Recebe `Tx` porque exigir do requerente e criar o e-mail da exigência
   * acontecem juntos ou não acontecem: ato desfeito não pode deixar e-mail
   * pronto para sair, e e-mail gravado sem o ato avisaria de algo que não
   * existe.
   *
   * Devolve `false` quando a chave de idempotência já existia — o segundo
   * clique não é erro, é um clique a mais.
   */
  enfileirar(tx: Tx, dados: NovoEmail): Promise<boolean>;

  /**
   * Reserva um lote para este worker, com `FOR UPDATE SKIP LOCKED`.
   *
   * É o que permite subir uma segunda réplica sem que as duas peguem o mesmo
   * e-mail e o destinatário receba dois. `SKIP LOCKED` faz a segunda pular o
   * que a primeira já segura, em vez de esperar por ele.
   *
   * A reserva incrementa `tentativas` e empurra `agendado_para`: se o processo
   * morrer no meio do envio, a linha volta sozinha para a fila depois da
   * espera, em vez de ficar presa para sempre.
   */
  reservarLote(limite: number): Promise<EmailParaEnviar[]>;

  marcarEnviado(id: string): Promise<void>;

  /** Guarda o erro e reagenda; no teto de tentativas, encerra como FALHOU. */
  marcarFalha(id: string, erro: string, proximaTentativa: Date | null): Promise<void>;

  listar(orgaoId: string, paginacao: Paginacao): Promise<Pagina<EmailNaFila>>;

  /** Devolve para a fila o que falhou — o botão de reenviar da tela. */
  reenfileirar(orgaoId: string, id: string): Promise<boolean>;
}
