/**
 * O texto dos quatro e-mails que o sistema manda.
 *
 * Fixo no código, e não no motor de documentos: são mensagens curtas e
 * operacionais, iguais para todas as prefeituras. O motor foi feito para peça
 * oficial impressa — timbre, código de conferência, assinatura — e nada disso
 * cabe numa notificação de três linhas.
 *
 * **Texto puro, sem HTML.** O que estes e-mails têm a dizer cabe em texto: quem
 * é a prefeitura, o que aconteceu, o link e o prazo. HTML traria a pergunta de
 * como fica sem imagens, no cliente antigo da repartição, no leitor de tela —
 * e a resposta seria "pior que o texto". Um `text/plain` bem escrito é lido em
 * qualquer lugar e nunca cai em filtro por parecer marketing.
 *
 * Nenhuma mensagem pede resposta: a caixa que envia não é lida por ninguém.
 * Toda uma aponta o link, que é onde a conversa acontece de verdade.
 */

export type TipoDeEmail =
  | "CONVITE_FORNECEDOR"
  | "CONVITE_CHECKLIST"
  | "EXIGENCIA_AO_REQUERENTE"
  | "PROTOCOLO_ABERTO";

export type MensagemPronta = {
  assunto: string;
  corpo: string;
};

/**
 * O assunto cabe numa linha da caixa de entrada.
 *
 * Em torno de 78 caracteres é o que o cliente de e-mail mostra sem cortar. Um
 * assunto cortado no meio de um número de protocolo obriga a abrir a mensagem
 * para saber do que se trata — e o cidadão que recebe uma exigência precisa
 * saber disso antes de abrir.
 */
const TETO_DO_ASSUNTO = 78;

const assunto = (texto: string): string =>
  texto.replace(/\s+/g, " ").trim().slice(0, TETO_DO_ASSUNTO);

/**
 * O rodapé, igual em toda mensagem.
 *
 * Diz três coisas, e todas por um motivo: de quem é o e-mail (o remetente é do
 * produto quando a prefeitura não tem domínio próprio), que não adianta
 * responder, e que o sistema mandou sozinho — quem recebe um e-mail inesperado
 * de um endereço desconhecido precisa poder decidir se confia.
 */
const rodape = (orgao: string): string =>
  [
    "",
    "--",
    orgao,
    "Mensagem automática: não responda a este e-mail, a caixa não é lida.",
  ].join("\n");

const montar = (orgao: string, linhas: string[]): string =>
  `${linhas.join("\n")}\n${rodape(orgao)}`;

/** Data no formato que se lê em voz alta: 04/09/2026. */
const dia = (data: string | Date): string => {
  const momento = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(momento.getTime())) return "";
  return momento.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" });
};

export type DadosDoConviteDeFornecedor = {
  orgao: string;
  fornecedor: string;
  link: string;
  expiraEm: string | Date;
};

export const conviteDeFornecedor = (dados: DadosDoConviteDeFornecedor): MensagemPronta => ({
  assunto: assunto(`${dados.orgao}: confira o cadastro de ${dados.fornecedor}`),
  corpo: montar(dados.orgao, [
    `Prezados de ${dados.fornecedor},`,
    "",
    `A ${dados.orgao} mantém o cadastro da sua empresa para fins de contratação, e`,
    "pede que os dados sejam conferidos e corrigidos por quem os conhece melhor:",
    "vocês.",
    "",
    "Abra o endereço abaixo para revisar razão social, endereço e contatos:",
    "",
    dados.link,
    "",
    `O link vale até ${dia(dados.expiraEm)} e abre apenas o cadastro da sua`,
    "empresa — nenhum contrato, processo ou informação de outra prefeitura.",
    "",
    // O CNPJ é a identidade do registro no cadastro global: editá-lo
    // transformaria o fornecedor em outro, levando junto o histórico de todas
    // as prefeituras. Dizer isso evita o pedido por telefone.
    "O CNPJ não pode ser alterado por aí. Se estiver errado, avise a prefeitura.",
  ]),
});

export type DadosDoConviteDeChecklist = {
  orgao: string;
  checklist: string;
  destinatario: string;
  link: string;
  expiraEm: string | Date;
};

export const conviteDeChecklist = (dados: DadosDoConviteDeChecklist): MensagemPronta => ({
  assunto: assunto(`${dados.orgao}: documentos pendentes — ${dados.checklist}`),
  corpo: montar(dados.orgao, [
    `${dados.destinatario},`,
    "",
    `A ${dados.orgao} precisa dos documentos relacionados em "${dados.checklist}".`,
    "",
    "No endereço abaixo você vê o que falta, envia cada arquivo e acompanha o que",
    "já foi aceito:",
    "",
    dados.link,
    "",
    `O link vale até ${dia(dados.expiraEm)} e pode ser usado quantas vezes for`,
    "preciso — dá para enviar um documento hoje e o resto depois.",
  ]),
});

export type DadosDaExigencia = {
  orgao: string;
  requerente: string;
  numeroProtocolo: string;
  descricao: string;
  link: string;
  prazoEm?: string | Date | null;
};

export const exigenciaAoRequerente = (dados: DadosDaExigencia): MensagemPronta => ({
  assunto: assunto(
    `${dados.orgao}: pendência no protocolo ${dados.numeroProtocolo}`,
  ),
  corpo: montar(dados.orgao, [
    `${dados.requerente},`,
    "",
    `O seu protocolo ${dados.numeroProtocolo} está parado à espera de uma`,
    "providência sua:",
    "",
    dados.descricao,
    "",
    "Responda pelo endereço abaixo, onde você também acompanha o andamento:",
    "",
    dados.link,
    "",
    ...(dados.prazoEm
      ? [
        // O prazo é o dado mais importante da mensagem, e por isso é o último:
        // é o que fica na tela quando a pessoa para de ler.
        `O prazo para responder vai até ${dia(dados.prazoEm)}.`,
      ]
      : [
        "Enquanto a pendência não for atendida, o processo não avança.",
      ]),
  ]),
});

export type DadosDoProtocolo = {
  orgao: string;
  requerente: string;
  numeroProtocolo: string;
  assuntoDoPedido: string;
  link: string;
};

export const protocoloAberto = (dados: DadosDoProtocolo): MensagemPronta => ({
  assunto: assunto(`${dados.orgao}: protocolo ${dados.numeroProtocolo} registrado`),
  corpo: montar(dados.orgao, [
    `${dados.requerente},`,
    "",
    `O seu pedido foi registrado sob o protocolo ${dados.numeroProtocolo}.`,
    "",
    `Assunto: ${dados.assuntoDoPedido}`,
    "",
    "Guarde este número. Por ele você acompanha o andamento a qualquer momento:",
    "",
    dados.link,
    "",
    "Se a prefeitura precisar de algum documento, você receberá um aviso neste",
    "mesmo endereço de e-mail.",
  ]),
});
