import { compare } from "bcryptjs";
import { ErroDeNegocio } from "../../domain/shared/ErroDeNegocio";
import type { UsuarioRepository } from "../ports/UsuarioRepository";

export type SessaoAutenticada = {
  usuarioId: string;
  orgaoId: string;
  nome: string;
  papelBase: string;
};

export class AutenticarUsuario {
  constructor(private readonly usuarios: UsuarioRepository) {}

  executar = async (identificador: string, senha: string): Promise<SessaoAutenticada> => {
    const usuario = await this.usuarios.buscarPorIdentificador(identificador);
    if (!usuario || !usuario.ativo) {
      throw new ErroDeNegocio("Credenciais inválidas", 401);
    }
    const senhaConfere = await compare(senha, usuario.senhaHash);
    if (!senhaConfere) {
      throw new ErroDeNegocio("Credenciais inválidas", 401);
    }
    return {
      usuarioId: usuario.id,
      orgaoId: usuario.orgaoId,
      nome: usuario.nome,
      papelBase: usuario.papelBase,
    };
  };
}
