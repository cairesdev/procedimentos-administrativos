import { hash } from "bcryptjs";
import { Conflito, ErroDeNegocio } from "../../domain/shared/ErroDeNegocio";
import type { NovaLotacao, UsuarioRepository } from "../ports/UsuarioRepository";

export type CriarUsuarioEntrada = {
  orgaoId: string;
  nome: string;
  email: string;
  username: string;
  senha: string;
  papelBase: string;
  lotacoes: Omit<NovaLotacao, "usuarioId">[];
};

export class CriarUsuario {
  constructor(private readonly usuarios: UsuarioRepository) {}

  executar = async (dados: CriarUsuarioEntrada): Promise<{ id: string }> => {
    if (await this.usuarios.existeEmail(dados.email)) {
      throw new Conflito(`E-mail ${dados.email} já cadastrado no sistema`);
    }
    if (await this.usuarios.existeUsername(dados.username)) {
      throw new Conflito(`Nome de usuário ${dados.username} já em uso`);
    }
    for (const lotacao of dados.lotacoes) {
      const destinos = [lotacao.unidadeId, lotacao.setorId, lotacao.departamentoId].filter(Boolean);
      if (destinos.length !== 1) {
        throw new ErroDeNegocio("Cada lotação aponta para exatamente um destino: unidade, setor ou departamento");
      }
    }

    const senhaHash = await hash(dados.senha, 10);
    const id = await this.usuarios.criar({
      orgaoId: dados.orgaoId,
      nome: dados.nome,
      email: dados.email,
      username: dados.username,
      senhaHash,
      papelBase: dados.papelBase,
    });
    for (const lotacao of dados.lotacoes) {
      await this.usuarios.criarLotacao({ ...lotacao, usuarioId: id });
    }
    return { id };
  };
}
