/**
 * As faixas dos sinais vitais — e a diferença entre recusar e avisar.
 *
 * Este arquivo faz duas coisas que parecem uma só e não são:
 *
 * 1. **Recusa o impossível.** Temperatura 368 °C e pulso 800 não existem em
 *    ser humano nenhum: é o dedo que escorregou no teclado. Recusar é certo,
 *    e o CHECK da 0048 recusa igual, porque a tela pode ser contornada.
 *
 * 2. **Avisa o improvável.** Saturação 71%, temperatura 41 °C e glicemia 480
 *    existem, são graves, e **não podem ser bloqueados** — é exatamente o
 *    paciente que o pronto atendimento precisa registrar depressa. O sistema
 *    diz "confere esse número?" e deixa passar.
 *
 * A tentação é transformar o aviso em trava, e isso mataria alguém: um
 * formulário que recusa saturação 71% é um formulário que obriga o enfermeiro
 * a escrever 91% para conseguir salvar.
 *
 * **Nada aqui é diagnóstico nem classificação de risco.** Não é Manchester,
 * não sugere conduta, não ordena fila. É conferência de digitação.
 */

export type SinalVital =
  | "glicemia" | "paSistolica" | "paDiastolica" | "pulso" | "saturacao" | "temperatura";

type Faixa = {
  rotulo: string;
  unidade: string;
  /** Fora disto é erro de digitação. Espelha o CHECK da migration 0048. */
  possivel: [number, number];
  /** Fora disto é grave, mas verdadeiro. Só avisa. */
  esperado: [number, number];
};

const FAIXAS: Record<SinalVital, Faixa> = {
  glicemia: {
    rotulo: "Glicemia capilar", unidade: "mg/dL",
    possivel: [10, 1000], esperado: [60, 250],
  },
  paSistolica: {
    rotulo: "Pressão sistólica", unidade: "mmHg",
    possivel: [40, 300], esperado: [90, 180],
  },
  paDiastolica: {
    rotulo: "Pressão diastólica", unidade: "mmHg",
    possivel: [20, 200], esperado: [50, 110],
  },
  pulso: {
    rotulo: "Pulso", unidade: "bpm",
    possivel: [20, 300], esperado: [50, 120],
  },
  saturacao: {
    rotulo: "Saturação", unidade: "%",
    possivel: [30, 100], esperado: [92, 100],
  },
  temperatura: {
    rotulo: "Temperatura", unidade: "°C",
    possivel: [25, 45], esperado: [35, 38],
  },
};

export type LeituraDeSinais = Partial<Record<SinalVital, number | null>>;

export type ConferenciaDeSinais = {
  /** Impede salvar. */
  erros: string[];
  /** Aparece na tela e não impede nada. */
  avisos: string[];
};

/**
 * Confere uma triagem inteira de uma vez.
 *
 * De uma vez porque o enfermeiro digita os cinco campos em sequência com o
 * paciente na frente: devolver um erro por vez faria a tela recusar cinco
 * vezes seguidas.
 */
export const conferirSinais = (leitura: LeituraDeSinais): ConferenciaDeSinais => {
  const erros: string[] = [];
  const avisos: string[] = [];

  for (const chave of Object.keys(FAIXAS) as SinalVital[]) {
    const valor = leitura[chave];
    if (valor === null || valor === undefined) continue;

    const faixa = FAIXAS[chave];
    if (!Number.isFinite(valor)) {
      erros.push(`${faixa.rotulo}: valor inválido.`);
      continue;
    }

    const [minimoPossivel, maximoPossivel] = faixa.possivel;
    if (valor < minimoPossivel || valor > maximoPossivel) {
      erros.push(
        `${faixa.rotulo} ${valor} ${faixa.unidade} está fora do que é possível `
        + `(${minimoPossivel} a ${maximoPossivel}). Confira o que foi digitado.`,
      );
      continue;
    }

    const [minimoEsperado, maximoEsperado] = faixa.esperado;
    if (valor < minimoEsperado || valor > maximoEsperado) {
      avisos.push(`${faixa.rotulo} ${valor} ${faixa.unidade} está fora da faixa usual.`);
    }
  }

  /**
   * Diastólica acima da sistólica é sempre inversão dos dois campos, e
   * passaria calada para o prontuário: os dois números são plausíveis
   * sozinhos, e só a relação entre eles denuncia a troca.
   */
  const { paSistolica, paDiastolica } = leitura;
  if (
    typeof paSistolica === "number" && typeof paDiastolica === "number"
    && paSistolica <= paDiastolica
  ) {
    erros.push(
      "A pressão sistólica precisa ser maior que a diastólica — os dois campos "
      + "parecem trocados.",
    );
  }

  return { erros, avisos };
};

/** Para a ficha impressa: "120 × 80 mmHg", ou vazio quando não foi medida. */
export const pressaoEscrita = (
  sistolica: number | null | undefined,
  diastolica: number | null | undefined,
): string => (
  typeof sistolica === "number" && typeof diastolica === "number"
    ? `${sistolica} × ${diastolica}`
    : ""
);
