import type { ModuleName } from "@/features/auth/types";
import type { Permission } from "./permissions";

export type NavIcon =
  | "inbox"
  | "fileSignature"
  | "building"
  | "shieldCheck"
  | "mapPin"
  | "package"
  | "clipboardCheck"
  | "truck"
  | "route"
  | "wrench"
  | "boxes";

export type NavLink = {
  href: string;
  label: string;
  permission: Permission;
};

export type NavSection = {
  group: string;
  icon: NavIcon;
  links: NavLink[];
};

export type WorkspaceId =
  | "processos"
  | "protocolo"
  | "patrimonio"
  | "almoxarifado"
  | "frotas"
  | "administracao";

export type Workspace = {
  id: WorkspaceId;
  /** Nome do sistema como o usuário o chama. */
  name: string;
  description: string;
  basePath: string;
  icon: NavIcon;
  /** Cor de destaque, para o usuário perceber em qual sistema está. */
  accent: string;
  accentSoft: string;
  /** Sem módulo definido, basta estar autenticado (caso da administração). */
  module?: ModuleName;
  /** Sem esta permissão, o sistema nem aparece no seletor. */
  permission: Permission;
  sections: NavSection[];
};

// Cada sistema tem navegação própria: nenhum menu cita telas de outro.
export const workspaces: Workspace[] = [
  {
    id: "processos",
    name: "Processos administrativos",
    description: "Licitações, atas, contratos, solicitações e tramitação",
    basePath: "/processos",
    icon: "fileSignature",
    accent: "#2f6fed",
    accentSoft: "#eaf2fe",
    module: "PROCESSOS",
    permission: "processes:read",
    sections: [
      {
        group: "Meu trabalho",
        icon: "inbox",
        links: [
          { href: "/processos/fila", label: "Fila do setor", permission: "processes:read" },
          { href: "/processos/solicitacoes", label: "Solicitações", permission: "requests:read" },
        ],
      },
      {
        group: "Contratação",
        icon: "fileSignature",
        links: [
          { href: "/processos/iniciar", label: "Iniciar procedimento", permission: "bids:write" },
          { href: "/processos/licitacoes", label: "Licitações", permission: "bids:read" },
          { href: "/processos/atas", label: "Atas de registro", permission: "bids:read" },
          { href: "/processos/contratos", label: "Contratos", permission: "contracts:read" },
          { href: "/processos/fornecedores", label: "Fornecedores", permission: "suppliers:read" },
        ],
      },
      {
        group: "Controle",
        icon: "shieldCheck",
        links: [
          { href: "/processos/fluxos", label: "Fluxo de tramitação", permission: "workflows:read" },
          { href: "/processos/auditoria", label: "Auditoria", permission: "audit:read" },
        ],
      },
    ],
  },
  {
    id: "protocolo",
    name: "Protocolo",
    description: "Atendimento de balcão e pedidos abertos pelo cidadão",
    basePath: "/protocolo",
    icon: "inbox",
    accent: "#a76a00",
    accentSoft: "#fdf3e2",
    module: "PROTOCOLO",
    permission: "protocol:read",
    sections: [
      {
        group: "Atendimento",
        icon: "inbox",
        links: [
          { href: "/protocolo/atendimentos", label: "Atendimentos", permission: "protocol:read" },
          {
            href: "/protocolo/atendimentos/novo",
            label: "Novo atendimento",
            permission: "protocol:serve",
          },
        ],
      },
      {
        group: "Configuração",
        icon: "shieldCheck",
        links: [
          { href: "/protocolo/assuntos", label: "Assuntos atendidos", permission: "protocol:manage" },
        ],
      },
    ],
  },
  {
    id: "patrimonio",
    name: "Patrimônio",
    description: "Bens tombados, locais, entradas e inventário",
    basePath: "/patrimonio",
    icon: "package",
    accent: "#0f7a52",
    accentSoft: "#e8f5ef",
    module: "PATRIMONIO",
    permission: "assets:read",
    sections: [
      {
        group: "Acervo",
        icon: "package",
        links: [
          { href: "/patrimonio/bens", label: "Bens", permission: "assets:read" },
          { href: "/patrimonio/entradas", label: "Entradas", permission: "assets:read" },
          {
            href: "/patrimonio/transferencias",
            label: "Transferências",
            permission: "assets:read",
          },
        ],
      },
      {
        group: "Conferência",
        icon: "clipboardCheck",
        links: [
          { href: "/patrimonio/inventarios", label: "Inventários", permission: "assets:read" },
        ],
      },
      {
        group: "Cadastros",
        icon: "mapPin",
        links: [
          { href: "/patrimonio/locais", label: "Locais", permission: "assets:read" },
          { href: "/patrimonio/categorias", label: "Categorias", permission: "assets:read" },
        ],
      },
    ],
  },
  {
    id: "almoxarifado",
    name: "Almoxarifado",
    description: "Entradas, pedidos das unidades, liberação e recebimento",
    basePath: "/almoxarifado",
    icon: "boxes",
    accent: "#7a3fa8",
    accentSoft: "#f3ecfa",
    module: "ALMOXARIFADO",
    permission: "stock:read",
    sections: [
      {
        group: "Movimento",
        icon: "boxes",
        links: [
          {
            href: "/almoxarifado/solicitacoes",
            label: "Pedidos",
            permission: "stock:read",
          },
          {
            href: "/almoxarifado/entradas",
            label: "Entradas",
            permission: "stock:manage",
          },
        ],
      },
      {
        group: "Estoque",
        icon: "package",
        links: [
          { href: "/almoxarifado/estoque", label: "Saldo por unidade", permission: "stock:read" },
          { href: "/almoxarifado/consumo", label: "Consumo", permission: "stock:read" },
          { href: "/almoxarifado/devolucoes", label: "Devoluções", permission: "stock:read" },
          {
            href: "/almoxarifado/transferencias",
            label: "Transferências",
            permission: "stock:read",
          },
          { href: "/almoxarifado/ajustes", label: "Ajustes", permission: "stock:read" },
        ],
      },
      {
        group: "Cadastros",
        icon: "mapPin",
        links: [
          {
            href: "/almoxarifado/almoxarifados",
            label: "Almoxarifados",
            permission: "stock:manage",
          },
          { href: "/almoxarifado/tipos", label: "Tipos de estoque", permission: "stock:manage" },
          { href: "/almoxarifado/locais", label: "Locais atendidos", permission: "stock:manage" },
        ],
      },
    ],
  },
  {
    id: "frotas",
    name: "Frotas",
    description: "Veículos, motoristas, viagens e manutenção",
    basePath: "/frotas",
    icon: "truck",
    accent: "#a76a00",
    accentSoft: "#fdf3e2",
    module: "FROTAS",
    permission: "fleet:read",
    sections: [
      {
        group: "Movimento",
        icon: "route",
        links: [
          { href: "/frotas/agenda", label: "Agenda", permission: "fleet:read" },
          { href: "/frotas/viagens", label: "Viagens", permission: "fleet:read" },
          { href: "/frotas/manutencoes", label: "Manutenções", permission: "fleet:read" },
        ],
      },
      {
        group: "Análise",
        icon: "wrench",
        links: [
          { href: "/frotas/relatorios", label: "Relatório de uso", permission: "fleet:read" },
        ],
      },
      {
        group: "Cadastros",
        icon: "truck",
        links: [
          { href: "/frotas/veiculos", label: "Veículos", permission: "fleet:read" },
          { href: "/frotas/motoristas", label: "Motoristas", permission: "fleet:read" },
        ],
      },
    ],
  },
  {
    id: "administracao",
    name: "Administração da prefeitura",
    description: "Unidades, setores e usuários que servem a todos os sistemas",
    basePath: "/administracao",
    icon: "building",
    accent: "#6d5ce7",
    accentSoft: "#f0edfd",
    permission: "units:read",
    sections: [
      {
        group: "Organização",
        icon: "building",
        links: [
          { href: "/administracao/unidades", label: "Unidades", permission: "units:read" },
          { href: "/administracao/setores", label: "Setores", permission: "sectors:read" },
          { href: "/administracao/usuarios", label: "Usuários", permission: "users:read" },
        ],
      },
      {
        group: "Documentos",
        icon: "fileSignature",
        links: [
          {
            href: "/administracao/documentos",
            label: "Modelos de documento",
            permission: "documents:template",
          },
        ],
      },
    ],
  },
];

export const findWorkspace = (id: WorkspaceId): Workspace =>
  workspaces.find((workspace) => workspace.id === id)!;
