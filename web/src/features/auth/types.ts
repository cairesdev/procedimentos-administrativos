export type Assignment = {
  id: string;
  unidadeId: string | null;
  setorId: string | null;
  departamentoId: string | null;
  destino: string;
};

export type Profile = {
  id: string;
  orgaoId: string;
  orgaoNome: string;
  nome: string;
  email: string;
  username: string;
  papelBase: Role;
  ativo: boolean;
  lotacoes: Assignment[];
  modulos: ModuleName[];
};

export type Role =
  | "ADMIN"
  | "GESTOR"
  | "SERVIDOR"
  | "PROTOCOLO"
  | "COMPRAS"
  | "CONTROLADORIA"
  | "NUTRICIONISTA"
  // A escola, a creche, o posto: quem recebe material e responde por ele.
  | "UNIDADE"
  | "PATRIMONIO"
  | "FROTAS";

export type ModuleName =
  | "PROCESSOS"
  | "FROTAS"
  | "PATRIMONIO"
  | "ALMOXARIFADO"
  | "PROTOCOLO"
  | "CHECKLIST";

export type LoginResponse = {
  token: string;
  usuario: { nome: string; papelBase: Role };
};
