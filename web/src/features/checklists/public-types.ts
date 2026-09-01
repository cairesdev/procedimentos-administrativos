/**
 * O que a página pública recebe.
 *
 * Menos que o detalhe interno, de propósito: só os itens do fornecedor, e sem
 * o nome de quem conferiu — é servidor da prefeitura, e não assunto de quem
 * está de fora.
 */
export type PublicChecklistItem = {
  id: string;
  titulo: string;
  descricao: string | null;
  exigeAnexo: boolean;
  prazoLimite: string | null;
  recorrente: boolean;
  situacao: "PENDENTE" | "AGUARDANDO_CONFERENCIA" | "CUMPRIDO" | "VENCIDO" | "DISPENSADO";
  ultimaEntrega: {
    cumpridoEm: string;
    vigenciaAte: string | null;
    recusaMotivo: string | null;
    anexos: number;
  } | null;
};

export type PublicChecklist = {
  titulo: string;
  descricao: string | null;
  orgaoNome: string;
  expiraEm: string;
  itens: PublicChecklistItem[];
};
