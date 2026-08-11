import type { Tx } from "../ports/Transacao";
import type { NumeracaoSequencia } from "../ports/ProcessoRepository";

export class GeradorNumeroProcesso {
  constructor(private readonly sequencias: NumeracaoSequencia) {}

  gerarPar = async (orgaoId: string, tx: Tx): Promise<{ protocolo: string; processoAdm: string }> => {
    const ano = new Date().getFullYear();
    const numProtocolo = await this.sequencias.proximoNumero(orgaoId, "PROTOCOLO", ano, tx);
    const numProcesso = await this.sequencias.proximoNumero(orgaoId, "PROCESSO_ADM", ano, tx);
    return {
      protocolo: `${String(numProtocolo).padStart(6, "0")}/${ano}`,
      processoAdm: `${String(numProcesso).padStart(3, "0")}/${ano}`,
    };
  };
}
