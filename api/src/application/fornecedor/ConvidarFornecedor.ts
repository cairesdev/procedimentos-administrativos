import { createHash, randomBytes } from "node:crypto";
import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type {
  ConviteDeFornecedor, FornecedorConviteRepository,
} from "../ports/FornecedorConviteRepository";
import type { DadosFornecedor, FornecedorRepository } from "../ports/FornecedorRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";
import { conviteDeFornecedor } from "../../domain/email/Mensagens";
import type { EnfileirarEmail, ResultadoDoEnfileiramento } from "../email/EnfileirarEmail";

/**
 * Dias de validade do convite.
 *
 * Trinta dias cobre o vaivém real — o e-mail chega, o responsável está de
 * férias, o contador procura o cartão CNPJ. Mais que isso vira chave esquecida
 * numa caixa de entrada.
 */
const DIAS_DE_VALIDADE = 30;

/** O que o fornecedor pode corrigir sozinho. */
export type DadosDoConvite = Partial<Omit<DadosFornecedor, "documento">>;

/**
 * Link externo do fornecedor.
 *
 * O cadastro é global e compartilhado entre prefeituras, e quem digita razão
 * social e endereço hoje é o setor de compras, copiando de um papel. Ninguém
 * conhece o dado melhor que o dono dele.
 *
 * **O documento não entra.** CNPJ é a identidade do registro: deixá-lo editável
 * transformaria o fornecedor em outro, levando junto o histórico e os contratos
 * de todas as prefeituras que o usam.
 */
export class ConvidarFornecedor {
  constructor(
    private readonly convites: FornecedorConviteRepository,
    private readonly fornecedores: FornecedorRepository,
    private readonly auditoria: AuditoriaRepository,
    private readonly transacao: ExecutorDeTransacao,
    private readonly emails: EnfileirarEmail,
    /** Endereço público do sistema, para montar o link do convite. */
    private readonly appUrl: string,
  ) {}

  /**
   * Gera o convite e devolve o token **uma única vez**.
   *
   * O banco guarda só o hash, então este é o único momento em que o token
   * existe em texto. Perdido o link, gera-se outro — que é o comportamento
   * certo, e o mesmo de qualquer sistema que leve segredo a sério.
   */
  convidar = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    fornecedorId: string;
    /** Nome da prefeitura, para o remetente e o corpo do e-mail. */
    orgaoNome?: string;
  }): Promise<{ token: string; expiraEm: string; email: ResultadoDoEnfileiramento }> => {
    const fornecedor = await this.fornecedores.buscarPorId(entrada.fornecedorId);
    if (!fornecedor) throw new NaoEncontrado("Fornecedor não encontrado");

    // Convite anterior desta prefeitura sai de cena: dois links vivos para o
    // mesmo fornecedor tornariam a revogação inútil.
    await this.convites.revogarAbertos(entrada.fornecedorId, entrada.orgaoId);

    const token = randomBytes(32).toString("base64url");
    const expiraEm = new Date(Date.now() + DIAS_DE_VALIDADE * 24 * 60 * 60 * 1000);

    /**
     * O convite e o aviso entram juntos.
     *
     * O endereço sai do cadastro do fornecedor — é o dado que ele mesmo
     * mantém, e o motivo pelo qual o convite existe. Sem e-mail cadastrado, o
     * link continua na tela para alguém mandar à mão.
     */
    const email = await this.transacao(async (tx) => {
      const conviteId = await this.convites.criar({
        fornecedorId: entrada.fornecedorId,
        orgaoId: entrada.orgaoId,
        criadoPor: entrada.usuarioId,
        tokenHash: hashDoToken(token),
        expiraEm: expiraEm.toISOString(),
      }, tx);

      return this.emails.executar(tx, {
        orgaoId: entrada.orgaoId,
        tipo: "CONVITE_FORNECEDOR",
        destinatario: fornecedor.email,
        referenciaId: entrada.fornecedorId,
        chave: `CONVITE_FORNECEDOR:${conviteId}`,
        mensagem: conviteDeFornecedor({
          orgao: entrada.orgaoNome ?? "Prefeitura",
          fornecedor: fornecedor.razaoSocial,
          link: `${this.appUrl}/fornecedor/${token}`,
          expiraEm,
        }),
      });
    });

    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "FORNECEDOR_CONVIDADO",
      referenciaId: entrada.fornecedorId,
      detalhes: {
        fornecedor: fornecedor.razaoSocial,
        expiraEm: expiraEm.toISOString(),
        email,
      },
    });

    return { token, expiraEm: expiraEm.toISOString(), email };
  };

  /**
   * O que a página pública mostra.
   *
   * Devolve o cadastro atual para o fornecedor conferir e corrigir — nunca a
   * lista de prefeituras que o contratam, nem contrato nenhum. O convite dá
   * acesso ao **próprio cadastro**, e só a ele.
   */
  abrir = async (token: string) => {
    const convite = await this.conviteValido(token);
    const fornecedor = await this.fornecedores.buscarPorId(convite.fornecedorId);
    if (!fornecedor) throw new NaoEncontrado("Fornecedor não encontrado");

    return {
      razaoSocial: fornecedor.razaoSocial,
      documento: fornecedor.documento,
      endereco: fornecedor.endereco,
      email: fornecedor.email,
      telefone: fornecedor.telefone,
      inscricaoEstadual: fornecedor.inscricaoEstadual,
      inscricaoMunicipal: fornecedor.inscricaoMunicipal,
      expiraEm: convite.expiraEm,
      orgaoConvidante: convite.orgaoNome,
    };
  };

  /** Grava o que o fornecedor corrigiu, com o autor `link_externo`. */
  salvar = async (token: string, dados: DadosDoConvite): Promise<void> => {
    const convite = await this.conviteValido(token);

    if (!dados.razaoSocial?.trim()) {
      throw new ErroDeNegocio("A razão social não pode ficar em branco");
    }

    // `link_externo` é o valor que a 0001 previu para este caso. Não há usuário
    // por trás: quem alterou foi o próprio fornecedor, sem conta no sistema.
    await this.fornecedores.atualizar(convite.fornecedorId, dados, "link_externo");
    await this.convites.registrarUso(convite.id);

    // A auditoria é da prefeitura que convidou — é ela que responde pelo
    // cadastro alterado, e é lá que a mudança precisa aparecer.
    await this.auditoria.registrar({
      orgaoId: convite.orgaoId,
      // Sem usuário: quem alterou foi o próprio fornecedor, que não tem conta.
      tipoEvento: "FORNECEDOR_ATUALIZADO_POR_LINK",
      referenciaId: convite.fornecedorId,
      detalhes: { campos: Object.keys(dados) },
    });
  };

  revogar = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    fornecedorId: string;
  }): Promise<void> => {
    await this.convites.revogarAbertos(entrada.fornecedorId, entrada.orgaoId);
    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "FORNECEDOR_CONVITE_REVOGADO",
      referenciaId: entrada.fornecedorId,
      detalhes: {},
    });
  };

  /** Convite desta prefeitura para este fornecedor, se houver um aberto. */
  situacao = (orgaoId: string, fornecedorId: string) =>
    this.convites.buscarAberto(fornecedorId, orgaoId);

  /**
   * Três motivos para recusar, e a mesma resposta para os três.
   *
   * Token inexistente, expirado e revogado dão o mesmo erro de propósito:
   * distinguir contaria a quem tem um link velho que ele **existiu**, e a quem
   * tenta adivinhar que chegou perto.
   */
  private conviteValido = async (token: string): Promise<ConviteDeFornecedor> => {
    const convite = await this.convites.buscarPorHash(hashDoToken(token));

    const invalido = !convite
      || convite.revogadoEm !== null
      || new Date(convite.expiraEm) <= new Date();

    if (invalido) {
      throw new NaoEncontrado(
        "Este link não é válido ou já expirou. Peça um novo à prefeitura.",
      );
    }
    return convite!;
  };
}

/**
 * O banco guarda o hash, nunca o token.
 *
 * SHA-256 sem sal basta aqui, ao contrário de senha: o token tem 256 bits de
 * entropia e não é reutilizado noutro lugar, então não há dicionário nem
 * rainbow table que ajude. O sal serve contra segredo fraco escolhido por
 * gente; este foi sorteado.
 */
export const hashDoToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
