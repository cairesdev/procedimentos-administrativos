import { compare, hash } from "bcryptjs";
import { Conflito, ErroDeNegocio } from "../../domain/shared/ErroDeNegocio";
import { garantirExiste } from "../shared/ExclusaoSegura";
import type {
  AdminSistemaRepository, EdicaoOrgao, NovoOrgao, TimbreDoOrgao,
} from "../ports/AdminSistemaRepository";
import type { UsuarioRepository } from "../ports/UsuarioRepository";

export type SessaoAdmin = { adminId: string; nome: string; email: string };

export type PrimeiroAdmin = {
  nome: string;
  email: string;
  username: string;
  senha: string;
};

export class AdministrarSistema {
  constructor(
    private readonly admins: AdminSistemaRepository,
    private readonly usuarios: UsuarioRepository,
  ) {}

  autenticar = async (email: string, senha: string): Promise<SessaoAdmin> => {
    const admin = await this.admins.buscarPorEmail(email);
    if (!admin || !admin.ativo) throw new ErroDeNegocio("Credenciais inválidas", 401);

    const confere = await compare(senha, admin.senhaHash);
    if (!confere) throw new ErroDeNegocio("Credenciais inválidas", 401);

    return { adminId: admin.id, nome: admin.nome, email: admin.email };
  };

  criarOrgao = async (dados: NovoOrgao, modulos: string[]): Promise<{ id: string }> => {
    if (await this.admins.existeCnpj(dados.cnpj)) {
      throw new Conflito(`Já existe prefeitura com o CNPJ ${dados.cnpj}`);
    }
    const id = await this.admins.criarOrgao(dados);
    if (modulos.length > 0) await this.admins.definirModulos(id, modulos);
    return { id };
  };

  atualizarOrgao = async (id: string, dados: EdicaoOrgao): Promise<void> => {
    garantirExiste(await this.admins.buscarOrgao(id), "Prefeitura");
    if (dados.cnpj && (await this.admins.existeCnpj(dados.cnpj, id))) {
      throw new Conflito(`Já existe prefeitura com o CNPJ ${dados.cnpj}`);
    }
    await this.admins.atualizarOrgao(id, dados);
  };

  definirModulos = async (id: string, modulos: string[]): Promise<void> => {
    garantirExiste(await this.admins.buscarOrgao(id), "Prefeitura");
    await this.admins.definirModulos(id, modulos);
  };

  salvarTimbre = async (id: string, dados: TimbreDoOrgao): Promise<void> => {
    garantirExiste(await this.admins.buscarOrgao(id), "Prefeitura");
    await this.admins.salvarTimbre(id, dados);
  };

  // O primeiro ADMIN da prefeitura, que antes só nascia por SQL.
  criarPrimeiroAdmin = async (orgaoId: string, dados: PrimeiroAdmin): Promise<{ id: string }> => {
    garantirExiste(await this.admins.buscarOrgao(orgaoId), "Prefeitura");

    if (await this.usuarios.existeEmail(dados.email)) {
      throw new Conflito(`E-mail ${dados.email} já cadastrado no sistema`);
    }
    if (await this.usuarios.existeUsername(dados.username)) {
      throw new Conflito(`Nome de usuário ${dados.username} já em uso`);
    }

    const id = await this.usuarios.criar({
      orgaoId,
      nome: dados.nome,
      email: dados.email,
      username: dados.username,
      senhaHash: await hash(dados.senha, 10),
      papelBase: "ADMIN",
    });
    return { id };
  };
}
