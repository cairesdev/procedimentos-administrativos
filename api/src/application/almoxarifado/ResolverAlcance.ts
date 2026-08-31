import { type Alcance, alcanceDe } from "../../domain/almoxarifado/AlcanceDeLocais";
import type { AlmoxarifadoRepository } from "../ports/AlmoxarifadoRepository";
import type { UsuarioRepository } from "../ports/UsuarioRepository";

/**
 * O que este usuário alcança, em ids, pronto para entrar no `WHERE`.
 *
 * `null` nos dois lados quer dizer "sem trava" — e é `null`, não lista vazia,
 * de propósito: `= ANY('{}')` é falso para tudo, então confundir os dois
 * esconderia o estoque inteiro do administrador em vez de mostrá-lo.
 */
export type LocaisAlcancados = {
  locais: string[] | null;
  almoxarifados: string[] | null;
};

export const SEM_TRAVA: LocaisAlcancados = { locais: null, almoxarifados: null };

export class ResolverAlcance {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly almoxarifado: AlmoxarifadoRepository,
  ) {}

  /**
   * Traduz a lotação em listas de ids.
   *
   * A escola vira ela mesma; o setor vira uma consulta, porque "os locais que
   * o meu almoxarifado atende" só o banco sabe responder.
   */
  resolver = async (orgaoId: string, usuarioId: string): Promise<LocaisAlcancados> => {
    const perfil = await this.usuarios.buscarPerfil(usuarioId);
    const alcance: Alcance = alcanceDe(perfil?.lotacoes ?? []);

    if (alcance.tipo === "TUDO") return SEM_TRAVA;

    if (alcance.tipo === "LOCAIS") {
      // Lista vazia de almoxarifados, e não `null`: quem é da escola não
      // administra almoxarifado nenhum, e o ajuste feito lá dentro não é dele.
      return { locais: alcance.locais, almoxarifados: [] };
    }

    return this.almoxarifado.alcanceDoSetor(orgaoId, alcance.setores);
  };
}
