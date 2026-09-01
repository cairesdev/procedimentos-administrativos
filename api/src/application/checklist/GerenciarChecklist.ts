import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { vigenciaAte } from "../../domain/checklist/SituacaoDoItem";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type {
  ChecklistRepository, NovoItemDeChecklist, NovoItemDeModelo,
} from "../ports/ChecklistRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";

/** Alvos que um checklist pode acompanhar — espelha o CHECK da 0033. */
export const ALVOS = [
  "PROCESSO", "CONTRATO", "LICITACAO", "ATA", "FORNECEDOR", "BEM", "VEICULO",
] as const;

export type Alvo = (typeof ALVOS)[number];

export const ehAlvo = (valor: string): valor is Alvo =>
  (ALVOS as readonly string[]).includes(valor);

/**
 * Modelos e checklists: escrever a lista, e aplicá-la.
 *
 * Aplicar **copia** os itens. Mudar o modelo depois não mexe no que já foi
 * aplicado — a lista de ontem precisa continuar dizendo o que se exigiu ontem,
 * pela mesma razão que o documento emitido congela seus dados.
 */
export class GerenciarChecklist {
  constructor(
    private readonly checklists: ChecklistRepository,
    private readonly auditoria: AuditoriaRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  // ---- Modelos -------------------------------------------------------------

  listarModelos = (orgaoId: string) => this.checklists.listarModelos(orgaoId);

  buscarModelo = async (orgaoId: string, id: string) => {
    const modelo = await this.checklists.buscarModelo(orgaoId, id);
    if (!modelo) throw new NaoEncontrado("Modelo de checklist não encontrado");
    return modelo;
  };

  criarModelo = async (entrada: {
    orgaoId: string;
    nome: string;
    descricao?: string | null;
    itens: NovoItemDeModelo[];
  }): Promise<{ id: string }> => {
    entrada.itens.forEach(exigirItemCoerente);

    return this.transacao(async (tx) => {
      const id = await this.checklists.criarModelo(entrada.orgaoId, {
        nome: entrada.nome, descricao: entrada.descricao,
      });
      await this.checklists.substituirItensDoModelo(
        entrada.orgaoId, id, numerar(entrada.itens), tx,
      );
      return { id };
    });
  };

  atualizarModelo = async (entrada: {
    orgaoId: string;
    id: string;
    nome: string;
    descricao?: string | null;
    ativo: boolean;
    itens: NovoItemDeModelo[];
  }): Promise<void> => {
    await this.buscarModelo(entrada.orgaoId, entrada.id);
    entrada.itens.forEach(exigirItemCoerente);

    await this.transacao(async (tx) => {
      await this.checklists.atualizarModelo(entrada.orgaoId, entrada.id, {
        nome: entrada.nome, descricao: entrada.descricao, ativo: entrada.ativo,
      });
      await this.checklists.substituirItensDoModelo(
        entrada.orgaoId, entrada.id, numerar(entrada.itens), tx,
      );
    });
  };

  /**
   * Modelo já aplicado não é excluído.
   *
   * O checklist guarda `modelo_id` como rastro de onde veio; apagar o modelo
   * deixaria a lista apontando para o nada. Inativar tira das opções e
   * preserva a origem.
   */
  removerModelo = async (orgaoId: string, id: string): Promise<void> => {
    await this.buscarModelo(orgaoId, id);
    if (await this.checklists.modeloEstaEmUso(orgaoId, id)) {
      throw new ErroDeNegocio(
        "Este modelo já foi aplicado a algum checklist e não pode ser excluído. "
        + "Inative-o para tirá-lo das opções.",
        422,
      );
    }
    await this.checklists.removerModelo(orgaoId, id);
  };

  // ---- Checklists ----------------------------------------------------------

  listar: ChecklistRepository["listar"] = (orgaoId, filtros) =>
    this.checklists.listar(orgaoId, filtros);

  /**
   * Busca o registro pelo que o servidor conhece: o número.
   *
   * Texto curto demais devolve vazio em vez de a prefeitura inteira — uma
   * letra casaria com tudo, e a lista de 20 primeiros não ajudaria ninguém.
   */
  buscarAlvos = async (orgaoId: string, tipo: string, busca: string) => {
    if (!ehAlvo(tipo)) throw new ErroDeNegocio(`Tipo de alvo desconhecido: ${tipo}`);
    if (busca.trim().length < 2) return [];
    return this.checklists.buscarAlvos(orgaoId, tipo, busca.trim());
  };

  listarDoAlvo: ChecklistRepository["listarDoAlvo"] = (orgaoId, alvoTipo, alvoId) =>
    this.checklists.listarDoAlvo(orgaoId, alvoTipo, alvoId);

  buscar = async (orgaoId: string, id: string) => {
    const checklist = await this.checklists.buscar(orgaoId, id);
    if (!checklist) throw new NaoEncontrado("Checklist não encontrado");
    return checklist;
  };

  /**
   * Cria a lista, de um modelo ou do zero.
   *
   * Vindo de modelo, o prazo em dias vira data: `hoje + prazoDias`, congelado.
   * No modelo, uma data fixa envelheceria junto com ele; no checklist, o dias
   * teria de ser recalculado a cada consulta contra uma origem que ninguém
   * guarda.
   */
  criar = async (entrada: {
    orgaoId: string;
    usuarioId: string;
    titulo?: string;
    descricao?: string | null;
    modeloId?: string | null;
    alvoTipo?: string | null;
    alvoId?: string | null;
    setorId?: string | null;
    departamentoId?: string | null;
    itens?: NovoItemDeChecklist[];
  }): Promise<{ id: string }> => {
    if ((entrada.alvoTipo === null) !== (entrada.alvoId === null)
        && Boolean(entrada.alvoTipo) !== Boolean(entrada.alvoId)) {
      throw new ErroDeNegocio("Informe o tipo e o id do alvo, ou nenhum dos dois");
    }
    if (entrada.alvoTipo && !ehAlvo(entrada.alvoTipo)) {
      throw new ErroDeNegocio(`Tipo de alvo desconhecido: ${entrada.alvoTipo}`);
    }

    const doModelo = entrada.modeloId
      ? await this.buscarModelo(entrada.orgaoId, entrada.modeloId)
      : null;

    const titulo = entrada.titulo?.trim() || doModelo?.nome;
    if (!titulo) throw new ErroDeNegocio("O checklist precisa de um título");

    const itens = doModelo
      ? doModelo.itens.map((item) => ({
        ordem: item.ordem,
        titulo: item.titulo,
        descricao: item.descricao,
        exigeAnexo: item.exigeAnexo,
        prazoLimite: emDias(item.prazoDias),
        recorrente: item.recorrente,
        periodicidadeDias: item.periodicidadeDias,
        setorId: item.setorId,
        departamentoId: item.departamentoId,
        paraFornecedor: item.paraFornecedor,
      }))
      : (entrada.itens ?? []);

    if (itens.length === 0) {
      throw new ErroDeNegocio("O checklist precisa de ao menos um item");
    }
    itens.forEach(exigirItemCoerente);

    return this.transacao(async (tx) => {
      const id = await this.checklists.criar({
        orgaoId: entrada.orgaoId,
        titulo,
        descricao: entrada.descricao ?? doModelo?.descricao ?? null,
        modeloId: entrada.modeloId ?? null,
        alvoTipo: entrada.alvoTipo ?? null,
        alvoId: entrada.alvoId ?? null,
        setorId: entrada.setorId ?? null,
        departamentoId: entrada.departamentoId ?? null,
        criadoPor: entrada.usuarioId,
      }, numerar(itens), tx);

      await this.auditoria.registrar({
        orgaoId: entrada.orgaoId,
        usuarioId: entrada.usuarioId,
        tipoEvento: "CHECKLIST_CRIADO",
        referenciaId: id,
        detalhes: {
          titulo,
          modelo: doModelo?.nome ?? null,
          alvo: entrada.alvoTipo ?? "avulso",
          itens: itens.length,
        },
      }, tx);

      return { id };
    });
  };

  atualizar = async (entrada: {
    orgaoId: string;
    id: string;
    titulo: string;
    descricao?: string | null;
    setorId?: string | null;
    departamentoId?: string | null;
  }): Promise<void> => {
    await this.buscar(entrada.orgaoId, entrada.id);
    await this.checklists.atualizar(entrada.orgaoId, entrada.id, entrada);
  };

  /**
   * Trocar os itens de um checklist que já tem cumprimento apagaria o que foi
   * entregue — os ciclos pendem do item, com `ON DELETE CASCADE`.
   */
  substituirItens = async (entrada: {
    orgaoId: string;
    id: string;
    itens: NovoItemDeChecklist[];
  }): Promise<void> => {
    const checklist = await this.buscar(entrada.orgaoId, entrada.id);

    const comCiclo = checklist.itens.filter((item) => item.ultimoCiclo !== null);
    if (comCiclo.length > 0) {
      throw new ErroDeNegocio(
        `Este checklist já tem entrega em ${comCiclo.length} `
        + `${comCiclo.length === 1 ? "item" : "itens"}: trocar a lista apagaria o que foi `
        + `entregue. Corrija item a item, ou dispense o que não vale mais.`,
        422,
      );
    }
    if (entrada.itens.length === 0) {
      throw new ErroDeNegocio("O checklist precisa de ao menos um item");
    }
    entrada.itens.forEach(exigirItemCoerente);

    await this.transacao((tx) => this.checklists.substituirItens(
      entrada.orgaoId, entrada.id, numerar(entrada.itens), tx,
    ));
  };

  remover = async (orgaoId: string, id: string): Promise<void> => {
    await this.buscar(orgaoId, id);
    await this.checklists.remover(orgaoId, id);
  };
}

/** Ordem vem da posição na lista: a tela manda os itens já ordenados. */
const numerar = <T extends { ordem?: number }>(itens: T[]): (T & { ordem: number })[] =>
  itens.map((item, indice) => ({ ...item, ordem: indice + 1 }));

/**
 * O que o banco recusaria, recusado antes com uma frase.
 *
 * Repete os CHECKs da 0033 de propósito: a constraint é a garantia, e esta
 * conferência é a explicação. Sem ela o usuário receberia "Erro interno".
 */
const exigirItemCoerente = (item: {
  titulo: string;
  recorrente: boolean;
  periodicidadeDias?: number | null;
  setorId?: string | null;
  departamentoId?: string | null;
  paraFornecedor: boolean;
}): void => {
  if (!item.titulo.trim()) throw new ErroDeNegocio("Todo item precisa de um título");

  if (item.recorrente && !item.periodicidadeDias) {
    throw new ErroDeNegocio(
      `"${item.titulo}" é recorrente e precisa de uma periodicidade em dias — `
      + `senão vence sem nunca saber quando.`,
    );
  }
  if (!item.recorrente && item.periodicidadeDias) {
    throw new ErroDeNegocio(
      `"${item.titulo}" tem periodicidade mas não é recorrente: marque como recorrente `
      + `ou apague a periodicidade.`,
    );
  }

  const destinos = [item.setorId, item.departamentoId].filter(Boolean).length
    + (item.paraFornecedor ? 1 : 0);
  if (destinos > 1) {
    throw new ErroDeNegocio(
      `"${item.titulo}" aponta para mais de um responsável. Dois responsáveis é ninguém `
      + `responsável.`,
    );
  }
};

/** Prazo em dias vira data no momento da aplicação, e não se recalcula. */
const emDias = (dias: number | null): string | null =>
  dias === null ? null : vigenciaAte(new Date().toISOString(), dias);
