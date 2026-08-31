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
      exigirDestinoUnico(lotacao);
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

/**
 * Exatamente um destino, e o banco cobra o mesmo.
 *
 * Conferir aqui troca o erro de constraint — que chega à tela como falha
 * genérica — por uma frase que diz o que está errado.
 */
export const exigirDestinoUnico = (lotacao: Omit<NovaLotacao, "usuarioId">): void => {
  const destinos = [
    lotacao.unidadeId, lotacao.setorId, lotacao.departamentoId, lotacao.localId,
  ].filter(Boolean);

  if (destinos.length !== 1) {
    throw new ErroDeNegocio(
      "Cada lotação aponta para exatamente um destino: unidade, setor, departamento ou escola",
    );
  }
};
