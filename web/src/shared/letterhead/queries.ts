import { apiRequest } from "@/shared/api/http-client";

export type Letterhead = {
  arquivoLogomarca: string | null;
  /** Segunda marca, à direita: programa ou secretaria, ao lado do brasão. */
  arquivoLogomarcaDireita: string | null;
  cabecalhoTimbre: string | null;
  rodapeTimbre: string | null;
};

/** Timbre da prefeitura do usuário logado. Configurado no painel do produto. */
export const getOwnLetterhead = () => apiRequest<Letterhead>("/auth/timbre");
