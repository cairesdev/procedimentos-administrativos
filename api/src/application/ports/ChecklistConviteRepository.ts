import type { Tx } from "./Transacao";
export type ConviteDeChecklist = {
  id: string;
  checklistId: string;
  /** Alcançado pelo checklist: o convite não guarda o órgão duas vezes. */
  orgaoId: string;
  orgaoNome: string;
  expiraEm: string;
  revogadoEm: string | null;
};

export interface ChecklistConviteRepository {
  criar(dados: {
    checklistId: string;
    tokenHash: string;
    destinatario: string | null;
    /**
     * Para onde o convite vai, quando há para onde.
     *
     * `destinatario` é um nome em texto livre — o convite vai para engenheiro,
     * cartório ou consórcio, que não estão em cadastro nenhum. Nome não é
     * endereço, e sem esta coluna não haveria como reenviar nem conferir
     * depois para qual endereço foi.
     */
    destinatarioEmail?: string | null;
    criadoPor: string;
    expiraEm: string;
  }, tx?: Tx): Promise<string>;
  buscarPorHash(tokenHash: string): Promise<ConviteDeChecklist | null>;
  buscarAberto(checklistId: string): Promise<
    {
      expiraEm: string; destinatario: string | null;
      destinatarioEmail: string | null; criadoEm: string;
    } | null
  >;
  revogarAbertos(checklistId: string): Promise<void>;
  registrarUso(conviteId: string): Promise<void>;
  /** O item é dos que o fornecedor cumpre? A trava do link externo. */
  itemEhDoFornecedor(itemId: string): Promise<boolean>;
  cicloPertenceAoChecklist(checklistId: string, cumprimentoId: string): Promise<boolean>;
}
