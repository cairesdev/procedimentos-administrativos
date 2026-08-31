export type Supplier = {
  id: string;
  documento: string;
  razaoSocial: string;
  endereco: string | null;
  email: string | null;
  telefone: string | null;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
};

/** O que a página pública do fornecedor mostra — nada além do próprio cadastro. */
export type SupplierInvitePage = {
  razaoSocial: string;
  documento: string;
  endereco: string | null;
  email: string | null;
  telefone: string | null;
  inscricaoEstadual: string | null;
  inscricaoMunicipal: string | null;
  expiraEm: string;
  orgaoConvidante: string;
};

/** Convite aberto desta prefeitura, para a tela de fornecedores mostrar. */
export type SupplierInvite = {
  id: string;
  expiraEm: string;
  usadoEm: string | null;
  criadoEm: string;
};
