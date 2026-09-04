import type { Tx } from "./Transacao";
/** Convite aberto, como as telas e o caso de uso o enxergam. */
export type ConviteDeFornecedor = {
  id: string;
  fornecedorId: string;
  orgaoId: string;
  orgaoNome: string;
  expiraEm: string;
  usadoEm: string | null;
  revogadoEm: string | null;
  criadoEm: string;
};

export type NovoConvite = {
  fornecedorId: string;
  orgaoId: string;
  criadoPor: string;
  /** Só o hash chega aqui: o token em texto existe uma vez, na resposta. */
  tokenHash: string;
  expiraEm: string;
};

export interface FornecedorConviteRepository {
  criar(dados: NovoConvite, tx?: Tx): Promise<string>;
  buscarPorHash(tokenHash: string): Promise<ConviteDeFornecedor | null>;
  /** Convite ainda de pé desta prefeitura para este fornecedor. */
  buscarAberto(fornecedorId: string, orgaoId: string): Promise<ConviteDeFornecedor | null>;
  registrarUso(id: string): Promise<void>;
  revogarAbertos(fornecedorId: string, orgaoId: string): Promise<void>;
}
