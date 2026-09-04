import { createHash, randomBytes } from "node:crypto";
import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { situacaoDoItem, vigenciaAte } from "../../domain/checklist/SituacaoDoItem";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type {
  ChecklistConviteRepository, ConviteDeChecklist,
} from "../ports/ChecklistConviteRepository";
import type { ChecklistRepository } from "../ports/ChecklistRepository";
import { conviteDeChecklist } from "../../domain/email/Mensagens";
import type { EnfileirarEmail, ResultadoDoEnfileiramento } from "../email/EnfileirarEmail";
import type { ExecutorDeTransacao } from "../ports/Transacao";

/**
 * Dias de validade do convite.
 *
 * Trinta dias, como o convite de fornecedor: cobre o vaivém real — o e-mail
 * chega, o responsável está de férias, o contador procura o documento. Mais
 * que isso vira chave esquecida numa caixa de entrada.
 */
const DIAS_DE_VALIDADE = 30;

/**
 * O fornecedor cumprindo exigências sem ter conta.
 *
 * **Ele vê só os itens que são dele.** O checklist mistura exigências de
 * Compras, da Controladoria e do fornecedor; mandar a lista inteira contaria a
 * quem está de fora o que a prefeitura exige de si mesma. Mesmo princípio do
 * convite de fornecedor, que dá acesso ao próprio cadastro e só a ele.
 *
 * **Ele não confere.** Cumprir e conferir são atos de pessoas diferentes, e o
 * link só carrega o primeiro — quem aceita continua sendo quem cobra.
 */
export class ConvidarParaChecklist {
  constructor(
    private readonly convites: ChecklistConviteRepository,
    private readonly checklists: ChecklistRepository,
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
   * existe em texto. Perdido o link, gera-se outro.
   */
  convidar = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    checklistId: string;
    destinatario?: string | null;
    /** Em branco, gera só o link — que é como a prefeitura trabalha hoje. */
    destinatarioEmail?: string | null;
    /** Nome da prefeitura, para o remetente e o corpo do e-mail. */
    orgaoNome?: string;
  }): Promise<{ token: string; expiraEm: string; email: ResultadoDoEnfileiramento }> => {
    const checklist = await this.checklists.buscar(entrada.orgaoId, entrada.checklistId);
    if (!checklist) throw new NaoEncontrado("Checklist não encontrado");

    const doFornecedor = checklist.itens.filter((item) => item.paraFornecedor);
    if (doFornecedor.length === 0) {
      throw new ErroDeNegocio(
        "Nenhum item deste checklist é do fornecedor. O link abriria uma lista vazia — "
        + "marque os itens que ele deve cumprir antes de convidar.",
        422,
      );
    }

    // Convite anterior sai de cena: dois links vivos para o mesmo checklist
    // tornariam a revogação inútil.
    await this.convites.revogarAbertos(entrada.checklistId);

    const token = randomBytes(32).toString("base64url");
    const expiraEm = new Date(Date.now() + DIAS_DE_VALIDADE * 24 * 60 * 60 * 1000);

    /**
     * O convite e o e-mail dele entram juntos, ou não entram.
     *
     * Se o e-mail não puder ser enfileirado, o convite continua — o link fica
     * na tela e alguém manda à mão, que é como metade das prefeituras
     * trabalha. O contrário é que não pode: e-mail avisando de um link que a
     * transação desfez.
     */
    const email = await this.transacao(async (tx) => {
      const conviteId = await this.convites.criar({
        checklistId: entrada.checklistId,
        tokenHash: hashDoToken(token),
        destinatario: entrada.destinatario?.trim() || null,
        destinatarioEmail: entrada.destinatarioEmail?.trim() || null,
        criadoPor: entrada.usuarioId,
        expiraEm: expiraEm.toISOString(),
      }, tx);

      return this.emails.executar(tx, {
        orgaoId: entrada.orgaoId,
        tipo: "CONVITE_CHECKLIST",
        destinatario: entrada.destinatarioEmail,
        referenciaId: entrada.checklistId,
        chave: `CONVITE_CHECKLIST:${conviteId}`,
        mensagem: conviteDeChecklist({
          orgao: entrada.orgaoNome ?? "Prefeitura",
          checklist: checklist.titulo,
          destinatario: entrada.destinatario?.trim() || "Prezados",
          link: `${this.appUrl}/checklist/${token}`,
          expiraEm,
        }),
      });
    });

    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "CHECKLIST_CONVITE_ENVIADO",
      referenciaId: entrada.checklistId,
      detalhes: {
        destinatario: entrada.destinatario ?? null,
        destinatarioEmail: entrada.destinatarioEmail ?? null,
        email,
        itens: doFornecedor.length,
        expiraEm: expiraEm.toISOString(),
      },
    });

    return { token, expiraEm: expiraEm.toISOString(), email };
  };

  /**
   * O que a página pública mostra.
   *
   * Só os itens do fornecedor, e nada sobre o alvo além do título: o link não
   * conta que processo é, nem que outras exigências existem.
   */
  abrir = async (token: string) => {
    const convite = await this.conviteValido(token);
    const checklist = await this.checklists.buscar(convite.orgaoId, convite.checklistId);
    if (!checklist) throw new NaoEncontrado("Checklist não encontrado");

    const hoje = new Date().toISOString().slice(0, 10);

    return {
      titulo: checklist.titulo,
      descricao: checklist.descricao,
      orgaoNome: convite.orgaoNome,
      expiraEm: convite.expiraEm,
      itens: checklist.itens
        .filter((item) => item.paraFornecedor)
        .map((item) => ({
          id: item.id,
          titulo: item.titulo,
          descricao: item.descricao,
          exigeAnexo: item.exigeAnexo,
          prazoLimite: item.prazoLimite,
          recorrente: item.recorrente,
          situacao: situacaoDoItem({
            dispensadoEm: item.dispensadoEm,
            prazoLimite: item.prazoLimite,
            ultimoCiclo: item.ultimoCiclo
              ? { situacao: item.ultimoCiclo.situacao, vigenciaAte: item.ultimoCiclo.vigenciaAte }
              : null,
          }, hoje),
          // Só o que interessa a quem cumpre: o que ele mandou, e a resposta.
          // Nome de quem conferiu não entra — é servidor da prefeitura.
          ultimaEntrega: item.ultimoCiclo
            ? {
              cumpridoEm: item.ultimoCiclo.cumpridoEm,
              vigenciaAte: item.ultimoCiclo.vigenciaAte,
              recusaMotivo: item.ultimoCiclo.recusaMotivo,
              anexos: item.ultimoCiclo.anexos.length,
            }
            : null,
        })),
    };
  };

  /**
   * O fornecedor entrega, pelo link.
   *
   * Abre um ciclo como qualquer outro, com `cumpridoPorExterno` — não há
   * usuário por trás. A conferência continua sendo de quem é de dentro.
   */
  cumprir = async (entrada: {
    token: string;
    itemId: string;
    observacao?: string | null;
  }): Promise<{ id: string }> => {
    const convite = await this.conviteValido(entrada.token);
    const item = await this.exigirItemDoFornecedor(convite, entrada.itemId);

    if (item.dispensadoEm) {
      throw new ErroDeNegocio("Este item foi dispensado e não precisa mais ser cumprido");
    }
    if (item.ultimoCicloSituacao === "AGUARDANDO") {
      throw new ErroDeNegocio(
        "Já existe uma entrega sua aguardando conferência neste item.",
        422,
      );
    }

    const agora = new Date().toISOString();

    return this.transacao(async (tx) => {
      const id = await this.checklists.abrirCiclo({
        itemId: item.id,
        ciclo: item.ultimoCiclo + 1,
        cumpridoPor: null,
        cumpridoPorExterno: true,
        observacao: entrada.observacao?.trim() || null,
        vigenciaAte: vigenciaAte(agora, item.periodicidadeDias),
      }, tx);

      await this.convites.registrarUso(convite.id);

      await this.auditoria.registrar({
        orgaoId: convite.orgaoId,
        // Sem usuário: quem entregou foi o fornecedor, que não tem conta.
        tipoEvento: "CHECKLIST_ITEM_CUMPRIDO",
        referenciaId: convite.checklistId,
        detalhes: { item: item.titulo, por: "link externo" },
      }, tx);

      return { id };
    });
  };

  /** Confere que o ciclo pertence a um item deste convite, antes do upload. */
  cicloDoConvite = async (token: string, cumprimentoId: string): Promise<string> => {
    const convite = await this.conviteValido(token);
    const doConvite = await this.convites.cicloPertenceAoChecklist(
      convite.checklistId, cumprimentoId,
    );
    if (!doConvite) throw new NaoEncontrado("Entrega não encontrada");
    return convite.orgaoId;
  };

  revogar = async (entrada: {
    orgaoId: string; usuarioId: string; checklistId: string;
  }): Promise<void> => {
    await this.convites.revogarAbertos(entrada.checklistId);
    await this.auditoria.registrar({
      orgaoId: entrada.orgaoId,
      usuarioId: entrada.usuarioId,
      tipoEvento: "CHECKLIST_CONVITE_REVOGADO",
      referenciaId: entrada.checklistId,
      detalhes: {},
    });
  };

  /** O convite aberto deste checklist, se houver — a tela mostra a situação. */
  situacao = (checklistId: string) => this.convites.buscarAberto(checklistId);

  /**
   * Três motivos para recusar, e a mesma resposta para os três.
   *
   * Token inexistente, expirado e revogado dão o mesmo erro de propósito:
   * distinguir contaria a quem tem um link velho que ele **existiu**, e a quem
   * tenta adivinhar que chegou perto.
   */
  private conviteValido = async (token: string): Promise<ConviteDeChecklist> => {
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

  /**
   * O item precisa ser deste checklist **e** do fornecedor.
   *
   * Sem a segunda metade, um id de item interno colado na requisição deixaria
   * o fornecedor cumprir exigência que não é dele — e a tela dele nem mostra
   * que ela existe.
   */
  private exigirItemDoFornecedor = async (
    convite: ConviteDeChecklist, itemId: string,
  ) => {
    const item = await this.checklists.buscarItemParaCumprir(convite.orgaoId, itemId);
    if (!item || item.checklistId !== convite.checklistId) {
      throw new NaoEncontrado("Item não encontrado");
    }

    const doFornecedor = await this.convites.itemEhDoFornecedor(itemId);
    if (!doFornecedor) throw new NaoEncontrado("Item não encontrado");

    return item;
  };
}

/**
 * O banco guarda o hash, nunca o token.
 *
 * SHA-256 sem sal basta, ao contrário de senha: o token tem 256 bits de
 * entropia e não é reutilizado noutro lugar, então não há dicionário nem
 * rainbow table que ajude. O sal serve contra segredo fraco escolhido por
 * gente; este foi sorteado.
 */
export const hashDoToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
