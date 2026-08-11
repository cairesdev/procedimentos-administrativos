import { hash } from "bcryptjs";
import { Conflito } from "../../domain/shared/ErroDeNegocio";
import { garantirExiste, garantirSemVinculos } from "../shared/ExclusaoSegura";
import type { EdicaoUsuario, UsuarioRepository } from "../ports/UsuarioRepository";

export type EditarUsuarioEntrada = Omit<EdicaoUsuario, "senhaHash"> & { senha?: string };

export class EditarUsuario {
  constructor(private readonly usuarios: UsuarioRepository) {}

  executar = async (
    orgaoId: string,
    id: string,
    dados: EditarUsuarioEntrada,
  ): Promise<void> => {
    const atual = garantirExiste(await this.usuarios.buscarPorId(orgaoId, id), "Usuário");

    if (dados.email && dados.email !== atual.email) {
      const duplicado = await this.usuarios.existeEmail(dados.email);
      if (duplicado) throw new Conflito(`E-mail ${dados.email} já cadastrado no sistema`);
    }

    const { senha, ...resto } = dados;
    await this.usuarios.atualizar(orgaoId, id, {
      ...resto,
      senhaHash: senha ? await hash(senha, 10) : undefined,
    });
  };

  // Quem já despachou ou emitiu parecer não pode sumir do histórico: só inativa.
  remover = async (orgaoId: string, id: string): Promise<void> => {
    garantirExiste(await this.usuarios.buscarPorId(orgaoId, id), "Usuário");
    garantirSemVinculos(await this.usuarios.contarVinculos(id), "Usuário");
    await this.usuarios.removerLotacoes(id);
    await this.usuarios.remover(orgaoId, id);
  };
}
