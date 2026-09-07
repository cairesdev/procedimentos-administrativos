import type { Permissao } from "../shared/Permissoes";

/**
 * Quem assina cada trecho da ficha — a divisão do papel, em um lugar só.
 *
 * O formulário impresso traz, em cada bloco, de quem é a assinatura e o
 * carimbo: "TRIAGEM DE ENFERMAGEM (preenchido, assinado e carimbado pelo
 * enfermeiro)", "Queixa clínica (preenchida, assinada e carimbada pelo(a)
 * médico(a))", "Horário de assinatura c/carimbo (aux./téc. de Enfermagem)".
 * Esta tabela é aquela frase, em código.
 *
 * Existe como dado, e não espalhada pelas rotas, por dois motivos. O primeiro
 * é o teste: uma rota que esqueça de exigir a permissão certa é invisível na
 * revisão e catastrófica no prontuário, e com a matriz aqui um guarda
 * estrutural consegue comparar rota por rota. O segundo é a ficha impressa,
 * que precisa dizer quem podia ter assinado cada bloco.
 *
 * **Separação estrita** (decisão 10 do levantamento): o médico não preenche a
 * triagem, nem no plantão de madrugada sem enfermeiro. Naquele caso a triagem
 * fica em branco e os sinais vitais entram na avaliação médica — que é o que
 * acontece no papel hoje, e não é ato de enfermagem assinado por quem não é
 * enfermeiro.
 */

export type AtoDaFicha =
  | "ABRIR"
  | "TRIAR"
  | "AVALIAR"
  | "SOLICITAR_EXAME"
  | "RESULTADO_DE_EXAME"
  | "PRESCREVER"
  | "ADMINISTRAR"
  | "EVOLUIR_ENFERMAGEM"
  | "EVOLUIR_MEDICO"
  | "PROCEDIMENTO"
  | "DESFECHO"
  | "RETIFICAR";

type Ato = {
  /** Como o bloco aparece na ficha. */
  rotulo: string;
  permissao: Permissao;
  /** Quem o papel manda assinar — o que vai impresso embaixo do bloco. */
  assinatura: string;
};

export const ATOS: Record<AtoDaFicha, Ato> = {
  ABRIR: {
    rotulo: "Identificação do paciente",
    permissao: "health:admit",
    assinatura: "Recepção",
  },
  TRIAR: {
    rotulo: "Triagem de enfermagem",
    permissao: "health:nursing",
    assinatura: "Ass. c/ carimbo do Enfermeiro(a)",
  },
  AVALIAR: {
    rotulo: "Serviço médico — queixa clínica",
    permissao: "health:medical",
    assinatura: "Ass. c/ carimbo do Médico(a)",
  },
  SOLICITAR_EXAME: {
    rotulo: "Exames solicitados",
    permissao: "health:medical",
    assinatura: "Ass. c/ carimbo do Médico(a)",
  },
  /**
   * O resultado é o único ato que duas categorias fazem.
   *
   * Ele chega do laboratório horas ou dias depois, muitas vezes fora do
   * plantão de quem pediu, e quem o transcreve é quem está lá. Travar no
   * médico faria o resultado esperar o próximo plantão dele — que é
   * exatamente o que a ficha em papel resolve deixando a folha na pasta.
   */
  RESULTADO_DE_EXAME: {
    rotulo: "Resultado de exame",
    permissao: "health:nursing",
    assinatura: "Quem transcreveu",
  },
  PRESCREVER: {
    rotulo: "Prescrição médica",
    permissao: "health:medical",
    assinatura: "Assinatura c/ carimbo do médico",
  },
  ADMINISTRAR: {
    rotulo: "Horário de administração",
    permissao: "health:medicate",
    assinatura: "Horário de assinatura c/ carimbo (aux./téc. de Enfermagem)",
  },
  EVOLUIR_ENFERMAGEM: {
    rotulo: "Evolução do paciente",
    permissao: "health:nursing",
    assinatura: "Enfermeiro(a)",
  },
  EVOLUIR_MEDICO: {
    rotulo: "Evolução médica",
    permissao: "health:medical",
    assinatura: "Médico(a)",
  },
  PROCEDIMENTO: {
    rotulo: "Procedimento realizado",
    permissao: "health:medical",
    assinatura: "Ass. c/ carimbo do Médico(a)",
  },
  DESFECHO: {
    rotulo: "Resumo de saída do paciente",
    permissao: "health:nursing",
    assinatura: "Ass. c/ carimbo do Enfermeiro(a)",
  },
  /**
   * Retificar é do mesmo alcance de quem escreveu — mas a checagem de que o
   * autor é o mesmo profissional não fica aqui: quem retifica pode ser o
   * colega do plantão seguinte, e a retificação já carrega o próprio autor.
   * O que a permissão garante é que ninguém de fora da clínica escreve no
   * prontuário.
   */
  RETIFICAR: {
    rotulo: "Retificação",
    permissao: "health:read",
    assinatura: "Autor da retificação",
  },
};

/**
 * O conselho é o carimbo.
 *
 * Estes atos não fecham sem CRM/COREN no cadastro de quem assina: é o que vai
 * impresso na ficha e é o que identifica o responsável perante o conselho.
 * Ficam de fora a abertura (a recepção não tem conselho) e a administração de
 * medicamento — o técnico de enfermagem tem COREN, mas o auxiliar nem sempre
 * está inscrito, e travar aí impediria o registro do horário.
 */
export const ATOS_QUE_EXIGEM_CONSELHO: AtoDaFicha[] = [
  "TRIAR", "AVALIAR", "PRESCREVER",
  "EVOLUIR_ENFERMAGEM", "EVOLUIR_MEDICO", "PROCEDIMENTO", "DESFECHO",
];
