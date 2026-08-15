import { Conflito, ErroDeNegocio } from "../../domain/shared/ErroDeNegocio";
import { garantirExiste, garantirSemVinculos } from "../shared/ExclusaoSegura";
import type {
  ConferenciaDeItem, EdicaoBem, EdicaoCategoria, EdicaoLocal, EdicaoRemessa, NovaCategoria,
  NovaRemessa, NovoLocal, PatrimonioRepository,
} from "../ports/PatrimonioRepository";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";
import type { ExecutorDeTransacao } from "../ports/Transacao";

export class GerenciarPatrimonio {
  constructor(
    private readonly patrimonio: PatrimonioRepository,
    private readonly auditoria: AuditoriaRepository,
    private readonly transacao: ExecutorDeTransacao,
  ) {}

  criarLocal = async (dados: NovoLocal): Promise<{ id: string }> => {
    if (await this.patrimonio.existeCodigoLocal(dados.orgaoId, dados.codigo)) {
      throw new Conflito(`Já existe local com o código ${dados.codigo}`);
    }
    return { id: await this.patrimonio.criarLocal(dados) };
  };

  // O código do local prefixa o tombamento dos bens: mudar quebraria a etiqueta.
  atualizarLocal = async (orgaoId: string, id: string, dados: EdicaoLocal): Promise<void> => {
    garantirExiste(await this.patrimonio.buscarLocal(orgaoId, id), "Local");
    await this.patrimonio.atualizarLocal(orgaoId, id, dados);
  };

  removerLocal = async (orgaoId: string, id: string): Promise<void> => {
    const local = garantirExiste(await this.patrimonio.buscarLocal(orgaoId, id), "Local");
    garantirSemVinculos({ bens: local.bens }, "Local");
    await this.patrimonio.removerLocal(orgaoId, id);
  };

  criarCategoria = async (dados: NovaCategoria): Promise<{ id: string }> => ({
    id: await this.patrimonio.criarCategoria(dados),
  });

  atualizarCategoria = async (orgaoId: string, id: string, dados: EdicaoCategoria) => {
    garantirExiste(await this.patrimonio.buscarCategoria(orgaoId, id), "Categoria");
    await this.patrimonio.atualizarCategoria(orgaoId, id, dados);
  };

  removerCategoria = async (orgaoId: string, id: string): Promise<void> => {
    const categoria = garantirExiste(await this.patrimonio.buscarCategoria(orgaoId, id), "Categoria");
    garantirSemVinculos({ bens: categoria.bens }, "Categoria");
    await this.patrimonio.removerCategoria(orgaoId, id);
  };

  // Uma remessa cria os bens de uma vez: 400 cadeiras viram 400 tombamentos.
  registrarRemessa = async (
    dados: NovaRemessa & { usuarioId?: string },
  ): Promise<{
    id: string;
    bens: number;
    primeiroTombamento?: string;
    ultimoTombamento?: string;
  }> => {
    if (dados.lotes.length === 0) {
      throw new ErroDeNegocio("Informe ao menos um lote de bens");
    }
    for (const lote of dados.lotes) {
      if (lote.quantidade < 1) {
        throw new ErroDeNegocio(`Quantidade inválida no lote ${lote.nomeBem}`);
      }
      garantirExiste(
        await this.patrimonio.buscarLocal(dados.orgaoId, lote.localDestinoId),
        "Local de destino",
      );
    }

    const resultado = await this.transacao(async (tx) => {
      const criada = await this.patrimonio.criarRemessa(dados, tx);
      await this.auditoria.registrar({
        orgaoId: dados.orgaoId,
        usuarioId: dados.usuarioId,
        tipoEvento: "BENS_TOMBADOS",
        referenciaId: criada.id,
        detalhes: {
          notaFiscal: dados.notaFiscal,
          quantidade: criada.tombamentos.length,
          tombamentos: criada.tombamentos.slice(0, 20),
        },
      }, tx);
      return criada;
    });

    // A lista inteira pode ter centenas de códigos: o cliente só precisa da faixa.
    return {
      id: resultado.id,
      bens: resultado.tombamentos.length,
      primeiroTombamento: resultado.tombamentos[0],
      ultimoTombamento: resultado.tombamentos[resultado.tombamentos.length - 1],
    };
  };

  // Só os dados da nota mudam. Lotes não: os bens já nasceram com tombamento.
  atualizarRemessa = async (
    orgaoId: string,
    id: string,
    dados: EdicaoRemessa,
  ): Promise<void> => {
    garantirExiste(await this.patrimonio.buscarRemessa(orgaoId, id), "Entrada");
    await this.patrimonio.atualizarRemessa(orgaoId, id, dados);
  };

  // Apaga os bens junto. O contador do local NÃO é estornado: o tombamento
  // excluído vira buraco na sequência, porque a etiqueta pode já estar colada.
  removerRemessa = async (orgaoId: string, id: string, usuarioId?: string): Promise<void> => {
    const remessa = garantirExiste(await this.patrimonio.buscarRemessa(orgaoId, id), "Entrada");
    garantirSemVinculos({ bens_conferidos_em_inventario: remessa.conferencias }, "Entrada");

    await this.transacao(async (tx) => {
      await this.patrimonio.removerRemessa(orgaoId, id, tx);
      await this.auditoria.registrar({
        orgaoId,
        usuarioId,
        tipoEvento: "ENTRADA_PATRIMONIO_EXCLUIDA",
        referenciaId: id,
        detalhes: { bensExcluidos: remessa.bens, notaFiscal: remessa.notaFiscal },
      }, tx);
    });
  };

  atualizarBem = async (orgaoId: string, id: string, dados: EdicaoBem): Promise<void> => {
    garantirExiste(await this.patrimonio.buscarBem(orgaoId, id), "Bem");
    await this.patrimonio.atualizarBem(orgaoId, id, dados);
  };

  removerBem = async (orgaoId: string, id: string, usuarioId?: string): Promise<void> => {
    const bem = garantirExiste(await this.patrimonio.buscarBem(orgaoId, id), "Bem");
    garantirSemVinculos({ conferencias_de_inventario: bem.conferencias }, "Bem");

    await this.patrimonio.removerBem(orgaoId, id);
    await this.auditoria.registrar({
      orgaoId,
      usuarioId,
      tipoEvento: "BEM_EXCLUIDO",
      referenciaId: id,
      detalhes: { codigoTombamento: bem.codigoTombamento, nome: bem.nome },
    });
  };

  abrirInventario = async (
    orgaoId: string,
    localId: string,
    dataInicio: string,
  ): Promise<{ id: string }> => {
    garantirExiste(await this.patrimonio.buscarLocal(orgaoId, localId), "Local");
    if (await this.patrimonio.inventarioAbertoNoLocal(orgaoId, localId)) {
      throw new ErroDeNegocio("Este local já tem um inventário em andamento");
    }
    return { id: await this.patrimonio.abrirInventario({ localId, dataInicio }) };
  };

  conferir = async (
    orgaoId: string,
    inventarioId: string,
    itens: ConferenciaDeItem[],
  ): Promise<void> => {
    const inventario = garantirExiste(
      await this.patrimonio.buscarInventario(orgaoId, inventarioId),
      "Inventário",
    );
    if (inventario.status === "CONCLUIDO") {
      throw new ErroDeNegocio("Inventário concluído não aceita novas conferências");
    }
    for (const item of itens) {
      await this.patrimonio.registrarConferencia(inventarioId, item);
    }
  };

  concluirInventario = async (orgaoId: string, id: string, usuarioId?: string): Promise<void> => {
    const inventario = garantirExiste(
      await this.patrimonio.buscarInventario(orgaoId, id),
      "Inventário",
    );
    if (inventario.status === "CONCLUIDO") {
      throw new ErroDeNegocio("Inventário já concluído");
    }

    await this.patrimonio.concluirInventario(orgaoId, id);
    await this.auditoria.registrar({
      orgaoId,
      usuarioId,
      tipoEvento: "INVENTARIO_CONCLUIDO",
      referenciaId: id,
      detalhes: {
        localId: inventario.localId,
        esperados: inventario.esperados,
        conferidos: inventario.conferidos,
        divergencias: inventario.divergencias,
      },
    });
  };
}
