import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { vigenciaAte } from "../../domain/checklist/SituacaoDoItem";
import { responsavelSugerido } from "../../domain/checklist/SetorSugerido";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type {
  ChecklistRepository, NovoItemDeChecklist, NovoItemDeModelo,
} from "../ports/ChecklistRepository";
import type { SetorRepository } from "../ports/OrganizacaoRepository";
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
    /**
     * O organograma da prefeitura, para resolver o setor que o modelo sugere.
     *
     * Só o modelo global precisa disso — ele nomeia "CONTABILIDADE" sem poder
     * apontar para a contabilidade de ninguém. Modelo próprio já grava o id.
     */
    private readonly setores: SetorRepository,
  ) {}

  // ---- Modelos -------------------------------------------------------------

  listarModelos = (orgaoId: string) => this.checklists.listarModelos(orgaoId);

  buscarModelo = async (orgaoId: string, id: string) => {
    const modelo = await this.checklists.buscarModelo(orgaoId, id);
    if (!modelo) throw new NaoEncontrado("Modelo de checklist não encontrado");
    return modelo;
  };

  /**
   * O modelo do sistema é lido por todos e escrito por ninguém.
   *
   * A trava já existe no SQL — todo `UPDATE`/`DELETE` casa por `orgao_id = $1`,
   * e a linha global tem `orgao_id` nulo. Só que sem esta guarda o efeito seria
   * um `UPDATE 0`: a tela salvaria, a API responderia 200 e nada teria mudado.
   * Recusar em voz alta é a diferença entre uma regra e um silêncio.
   */
  private exigirModeloProprio = async (orgaoId: string, id: string) => {
    const modelo = await this.buscarModelo(orgaoId, id);
    if (modelo.global) {
      throw new ErroDeNegocio(
        "Este é um modelo padrão do sistema e não pode ser alterado. "
        + "Duplique-o para a sua entidade e edite a cópia.",
        422,
      );
    }
    return modelo;
  };

  /**
   * Copia um modelo para a prefeitura, itens e apoios inclusive.
   *
   * É o caminho de edição do modelo global: em vez de uma exceção de escrita
   * para a linha compartilhada, uma cópia que pertence a quem vai mexer nela.
   */
  duplicarModelo = async (
    orgaoId: string, id: string, nome?: string,
  ): Promise<{ id: string }> => {
    const origem = await this.buscarModelo(orgaoId, id);

    return this.transacao(async (tx) => {
      const novo = await this.checklists.criarModelo(orgaoId, {
        nome: (nome?.trim() || `${origem.nome} (cópia)`).slice(0, 150),
        descricao: origem.descricao,
      });
      await this.checklists.substituirItensDoModelo(
        orgaoId,
        novo,
        origem.itens.map(({ id: _id, apoios, ...item }) => ({
          ...item,
          apoios: (apoios ?? []).map(({ setorId, departamentoId }) => ({
            setorId, departamentoId,
          })),
        })),
        tx,
      );
      return { id: novo };
    });
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
    await this.exigirModeloProprio(entrada.orgaoId, entrada.id);
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
    await this.exigirModeloProprio(orgaoId, id);
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

    /**
     * O modelo vai inteiro para o checklist.
     *
     * A cópia deixava para trás seção, código, classificação, o arquivo de
     * referência e os apoios — justo o que o roteiro do PNTP carrega. O
     * checklist nascia com os 53 títulos e nenhuma dimensão: a tela agrupava
     * tudo em "sem seção" e a contagem por classificação vinha zerada. Só o
     * prazo se converte, de dias para data; o resto é o mesmo item.
     *
     * O organograma só é consultado quando há sugestão para resolver — e o
     * modelo próprio, que grava o id do setor, nunca tem.
     */
    const organograma = doModelo?.itens.some((item) => item.setorSugerido)
      ? (await this.setores.listarSetores(entrada.orgaoId)).filter((setor) => setor.ativo)
      : [];

    const itens = doModelo
      ? doModelo.itens.map(({ id: _id, prazoDias, apoios, setorSugerido, ...item }) => {
        /**
         * A sugestão do Tribunal vira responsável — quando dá.
         *
         * Vale só como preenchimento inicial, e perde para o que o modelo já
         * disse: um modelo próprio que nomeia o setor está falando do
         * organograma real, e adivinhar por cima seria trocar certeza por
         * palpite. Casar sozinha poupa 53 atribuições à mão todo mês; não
         * casar deixa em branco, que é onde a lista estava antes.
         *
         * Item do fornecedor fica de fora: o item aponta para **um**
         * responsável, e dar setor a quem já é do fornecedor derrubaria a
         * criação inteira em `exigirItemCoerente`.
         */
        const sugerido = item.setorId || item.paraFornecedor
          ? { setorId: item.setorId, apoios: [] }
          : responsavelSugerido(setorSugerido, organograma);

        // `?? []`: o repositório sempre traz a lista, mas item de modelo sem
        // apoio é caso normal — e um `.map` sobre indefinido derruba a criação
        // inteira do checklist por causa de um campo opcional.
        const declarados = (apoios ?? []).map(({ setorId, departamentoId }) => ({
          setorId, departamentoId,
        }));

        return {
          ...item,
          setorId: sugerido.setorId,
          prazoLimite: emDias(prazoDias),
          apoios: declarados.length > 0 ? declarados : sugerido.apoios,
        };
      })
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
