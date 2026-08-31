import { hash } from "bcryptjs";
import { Conflito } from "../../domain/shared/ErroDeNegocio";
import { garantirExiste, garantirSemVinculos } from "../shared/ExclusaoSegura";
import type {
  EdicaoUsuario, NovaLotacao, UsuarioRepository,
} from "../ports/UsuarioRepository";
import { exigirDestinoUnico } from "./CriarUsuario";

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

  /**
   * Troca a lotação inteira, em vez de acrescentar.
   *
   * A tela mostra o vínculo atual e grava o que ficou; somar criaria uma
   * segunda lotação silenciosa, e o usuário passaria a alcançar as duas
   * escolas — que é o oposto do que a correção pretendia.
   */
  substituirLotacoes = async (
    orgaoId: string,
    id: string,
    lotacoes: Omit<NovaLotacao, "usuarioId">[],
  ): Promise<void> => {
    garantirExiste(await this.usuarios.buscarPorId(orgaoId, id), "Usuário");
    for (const lotacao of lotacoes) exigirDestinoUnico(lotacao);

    await this.usuarios.removerLotacoes(id);
    for (const lotacao of lotacoes) {
      await this.usuarios.criarLotacao({ ...lotacao, usuarioId: id });
    }
  };

  // Quem já despachou ou emitiu parecer não pode sumir do histórico: só inativa.
  remover = async (orgaoId: string, id: string): Promise<void> => {
    garantirExiste(await this.usuarios.buscarPorId(orgaoId, id), "Usuário");
    garantirSemVinculos(await this.usuarios.contarVinculos(id), "Usuário");
    await this.usuarios.removerLotacoes(id);
    await this.usuarios.remover(orgaoId, id);
  };
}
