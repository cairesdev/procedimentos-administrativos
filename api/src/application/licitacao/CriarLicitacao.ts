import type { LicitacaoRepository, NovaLicitacao } from "../ports/LicitacaoRepository";

export class CriarLicitacao {
  constructor(private readonly licitacoes: LicitacaoRepository) {}

  /**
   * O número **pode repetir**.
   *
   * A numeração reinicia a cada exercício — o mesmo "025/2026" volta em 2027 —
   * e a de uma ata carrega o número do órgão que a gerou. Recusar duplicata
   * obrigava o servidor a inventar um sufixo que não existe no papel, e aí o
   * sistema deixava de bater com o processo físico. Quem identifica é o `id`.
   */
  executar = async (dados: NovaLicitacao): Promise<{ id: string }> => {
    const id = await this.licitacoes.criar(dados);
    return { id };
  };
}
