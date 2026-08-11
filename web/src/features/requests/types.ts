export type RequestItem = {
  itemId: string;
  quantidadeSolicitada: number;
  valorCalculado: number;
};

export type RequestDetail = {
  id: string;
  orgaoId: string;
  processoId: string | null;
  unidadeSolicitanteId: string;
  situacao: "RASCUNHO" | "ENVIADA";
  itens: RequestItem[];
};

export type CreatedRequest = { id: string };

export type SentRequest = {
  processoId: string;
  protocolo: string;
  processoAdm: string;
};
