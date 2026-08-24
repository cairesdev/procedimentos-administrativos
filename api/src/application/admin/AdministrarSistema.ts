import { randomUUID } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { Conflito, ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { garantirExiste } from "../shared/ExclusaoSegura";
import { sanitizarNomeDeArquivo as sanitizar } from "../shared/NomeDeArquivo";
import type {
  AdministradorDaEntidade, AdminSistemaRepository, EdicaoOrgao, NovoOrgao, TimbreDoOrgao,
} from "../ports/AdminSistemaRepository";
import type {
  ArmazenamentoArquivos, ArquivoParaLeitura,
} from "../ports/ArmazenamentoArquivos";
import type { AuditoriaRepository, TipoEvento } from "../ports/AuditoriaRepository";
import type { UsuarioRepository } from "../ports/UsuarioRepository";

export type SessaoAdmin = { adminId: string; nome: string; email: string };

/** Quem, do lado do produto, executou a ação sobre a prefeitura. */
export type AutorDaAcao = { nome: string; email: string };

export type PrimeiroAdmin = {
  nome: string;
  email: string;
  username: string;
  senha: string;
};

/** Tipos que um brasão pode ter — o que navegador e impressão renderizam. */
const IMAGENS_ACEITAS = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const TAMANHO_MAXIMO = 2 * 1024 * 1024;

export class AdministrarSistema {
  constructor(
    private readonly admins: AdminSistemaRepository,
    private readonly usuarios: UsuarioRepository,
    private readonly auditoria: AuditoriaRepository,
    private readonly armazenamento: ArmazenamentoArquivos,
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

  /**
   * Só texto: a logomarca tem caminho no storage e é trocada pelo upload —
   * deixar o caminho editável à mão apagaria o arquivo enviado.
   */
  salvarTimbre = async (
    id: string,
    dados: Omit<TimbreDoOrgao, "arquivoLogomarca">,
  ): Promise<void> => {
    garantirExiste(await this.admins.buscarOrgao(id), "Prefeitura");
    const atual = await this.admins.buscarTimbre(id);
    await this.admins.salvarTimbre(id, {
      ...dados,
      arquivoLogomarca: atual?.arquivoLogomarca ?? null,
    });
  };

  enviarLogomarca = async (dados: {
    orgaoId: string;
    conteudo: Buffer;
    mimeType: string;
    nomeOriginal: string;
  }): Promise<{ arquivoLogomarca: string }> => {
    garantirExiste(await this.admins.buscarOrgao(dados.orgaoId), "Prefeitura");
    if (!IMAGENS_ACEITAS.includes(dados.mimeType)) {
      throw new ErroDeNegocio("Envie a logomarca em PNG, JPEG, WEBP ou SVG");
    }
    if (dados.conteudo.length > TAMANHO_MAXIMO) {
      throw new ErroDeNegocio("Logomarca acima de 2 MB");
    }

    const atual = await this.admins.buscarTimbre(dados.orgaoId);
    const caminho = `${dados.orgaoId}/timbre/${randomUUID()}-${sanitizar(dados.nomeOriginal)}`;

    // Grava o arquivo antes do banco; só apaga o antigo depois que o novo
    // caminho está persistido, para nunca ficar com o registro apontando
    // para um objeto que não existe mais.
    await this.armazenamento.salvar(caminho, dados.conteudo, dados.mimeType);
    try {
      await this.admins.salvarTimbre(dados.orgaoId, {
        cabecalhoTimbre: atual?.cabecalhoTimbre ?? null,
        rodapeTimbre: atual?.rodapeTimbre ?? null,
        arquivoLogomarca: caminho,
      });
    } catch (error) {
      await this.armazenamento.remover(caminho);
      throw error;
    }

    if (atual?.arquivoLogomarca) {
      await this.armazenamento
        .remover(atual.arquivoLogomarca)
        .catch((erro) => console.error("Logomarca antiga não removida", erro));
    }
    return { arquivoLogomarca: caminho };
  };

  /** Bytes da logomarca do órgão, para a API servir a imagem. */
  abrirLogomarca = async (orgaoId: string): Promise<ArquivoParaLeitura> => {
    const timbre = await this.admins.buscarTimbre(orgaoId);
    if (!timbre?.arquivoLogomarca) throw new NaoEncontrado("Logomarca não configurada");
    return this.armazenamento.abrir(timbre.arquivoLogomarca);
  };

  // ---- Administradores do produto -----------------------------------------

  listarAdminsDoSistema = () => this.admins.listarAdminsDoSistema();

  criarAdminDoSistema = async (dados: {
    nome: string;
    email: string;
    senha: string;
  }): Promise<{ id: string }> => {
    const email = dados.email.toLowerCase();
    if (await this.admins.buscarPorEmail(email)) {
      throw new Conflito(`Já existe administrador com o e-mail ${email}`);
    }
    return {
      id: await this.admins.criarAdminDoSistema({
        nome: dados.nome,
        email,
        senhaHash: await hash(dados.senha, 10),
      }),
    };
  };

  redefinirSenhaDeAdminDoSistema = async (id: string, novaSenha: string): Promise<void> => {
    garantirExiste(await this.admins.buscarAdminPorId(id), "Administrador");
    await this.admins.atualizarAdminDoSistema(id, { senhaHash: await hash(novaSenha, 10) });
  };

  /**
   * Duas travas: ninguém se auto-inativa (perderia o acesso no mesmo clique) e
   * o produto nunca fica sem nenhum administrador — daí só se sai por SQL.
   */
  definirSituacaoDeAdminDoSistema = async (
    id: string,
    ativo: boolean,
    autorId?: string,
  ): Promise<void> => {
    const admin = garantirExiste(await this.admins.buscarAdminPorId(id), "Administrador");

    if (!ativo) {
      if (autorId && autorId === id) {
        throw new ErroDeNegocio("Você não pode inativar o seu próprio acesso");
      }
      const restantes = await this.admins.contarAdminsDoSistemaAtivos(id);
      if (restantes === 0) {
        throw new ErroDeNegocio(
          "Este é o único administrador ativo do sistema. Cadastre outro antes de inativar.",
          422,
          { adminsAtivosRestantes: 0 },
        );
      }
    }

    await this.admins.atualizarAdminDoSistema(admin.id, { ativo });
  };

  // ---- Administradores da prefeitura --------------------------------------

  listarAdministradores = async (orgaoId: string): Promise<AdministradorDaEntidade[]> => {
    garantirExiste(await this.admins.buscarOrgao(orgaoId), "Prefeitura");
    return this.admins.listarAdministradores(orgaoId);
  };

  /** Servidores que ainda não são ADMIN, para promover sem duplicar cadastro. */
  listarPromoviveis = async (orgaoId: string) => {
    garantirExiste(await this.admins.buscarOrgao(orgaoId), "Prefeitura");
    const usuarios = await this.usuarios.listar(orgaoId);
    return usuarios.filter((usuario) => usuario.papelBase !== "ADMIN" && usuario.ativo);
  };

  criarAdministrador = async (
    orgaoId: string,
    dados: PrimeiroAdmin,
    autor?: AutorDaAcao,
  ): Promise<{ id: string }> => {
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

    await this.registrar(orgaoId, "ADMIN_ENTIDADE_CRIADO", id, autor, {
      nome: dados.nome,
      email: dados.email,
    });
    return { id };
  };

  promoverAdministrador = async (
    orgaoId: string,
    usuarioId: string,
    autor?: AutorDaAcao,
  ): Promise<void> => {
    garantirExiste(await this.admins.buscarOrgao(orgaoId), "Prefeitura");
    const usuario = garantirExiste(
      await this.usuarios.buscarPorId(orgaoId, usuarioId),
      "Usuário",
    );
    if (usuario.papelBase === "ADMIN") {
      throw new ErroDeNegocio(`${usuario.nome} já é administrador`);
    }

    await this.usuarios.atualizar(orgaoId, usuarioId, { papelBase: "ADMIN" });
    await this.registrar(orgaoId, "ADMIN_ENTIDADE_PROMOVIDO", usuarioId, autor, {
      nome: usuario.nome,
      papelAnterior: usuario.papelBase,
    });
  };

  /**
   * Redefinição pelo fornecedor: o caminho quando o administrador da prefeitura
   * perde o acesso e não há mais ninguém lá dentro para socorrê-lo. Fica na
   * auditoria da prefeitura, que é quem precisa enxergar isso.
   */
  redefinirSenhaDeAdministrador = async (
    orgaoId: string,
    usuarioId: string,
    novaSenha: string,
    autor?: AutorDaAcao,
  ): Promise<void> => {
    garantirExiste(await this.admins.buscarOrgao(orgaoId), "Prefeitura");
    const usuario = garantirExiste(
      await this.usuarios.buscarPorId(orgaoId, usuarioId),
      "Usuário",
    );
    if (usuario.papelBase !== "ADMIN") {
      throw new ErroDeNegocio("Só a senha de administrador é redefinida por aqui");
    }

    await this.usuarios.atualizar(orgaoId, usuarioId, {
      senhaHash: await hash(novaSenha, 10),
    });
    await this.registrar(orgaoId, "ADMIN_ENTIDADE_SENHA_REDEFINIDA", usuarioId, autor, {
      nome: usuario.nome,
    });
  };

  definirSituacaoDeAdministrador = async (
    orgaoId: string,
    usuarioId: string,
    ativo: boolean,
    autor?: AutorDaAcao,
  ): Promise<void> => {
    garantirExiste(await this.admins.buscarOrgao(orgaoId), "Prefeitura");
    const usuario = garantirExiste(
      await this.usuarios.buscarPorId(orgaoId, usuarioId),
      "Usuário",
    );
    if (usuario.papelBase !== "ADMIN") {
      throw new ErroDeNegocio("Este usuário não é administrador");
    }

    // Sem nenhum ADMIN ativo, ninguém na prefeitura cadastra usuário nem
    // configura nada — e só o fornecedor consegue destravar.
    if (!ativo) {
      const restantes = await this.admins.contarAdministradoresAtivos(orgaoId, usuarioId);
      if (restantes === 0) {
        throw new ErroDeNegocio(
          "Este é o único administrador ativo da prefeitura. Cadastre ou promova outro antes de inativar.",
          422,
          { administradoresAtivosRestantes: 0 },
        );
      }
    }

    await this.usuarios.atualizar(orgaoId, usuarioId, { ativo });
    await this.registrar(
      orgaoId,
      ativo ? "ADMIN_ENTIDADE_REATIVADO" : "ADMIN_ENTIDADE_INATIVADO",
      usuarioId,
      autor,
      { nome: usuario.nome },
    );
  };

  /**
   * O autor é um admin do produto, que não existe na tabela `usuario` — por
   * isso vai em `detalhes` em vez de `usuarioId`.
   */
  private registrar = async (
    orgaoId: string,
    tipoEvento: TipoEvento,
    referenciaId: string,
    autor?: AutorDaAcao,
    detalhes: Record<string, unknown> = {},
  ) => {
    await this.auditoria.registrar({
      orgaoId,
      tipoEvento,
      referenciaId,
      detalhes: {
        ...detalhes,
        porAdminDoSistema: autor ? { nome: autor.nome, email: autor.email } : "desconhecido",
      },
    });
  };
}
