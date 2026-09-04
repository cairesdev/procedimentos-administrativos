import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";
import { chaveDoAmbiente, cifrar, decifrar } from "../../domain/email/SegredoDoSmtp";
import { enderecoValido, remetenteComNome } from "../../domain/email/Remetente";
import type {
  ConfiguracaoEmailRepository, ConfiguracaoNaTela,
} from "../ports/ConfiguracaoEmailRepository";
import type { EnviadorDeEmail } from "../ports/EnviadorDeEmail";
import type { AuditoriaRepository } from "../ports/AuditoriaRepository";

export type DadosDaTela = {
  host: string;
  porta: number;
  usuario?: string | null;
  /**
   * Em branco não apaga: quem entrou para corrigir a porta não pode sair sem
   * senha. Para tirar a autenticação, manda-se `null` explicitamente.
   */
  senha?: string | null;
  remetente: string;
  tlsDireto: boolean;
  ativo: boolean;
};

/**
 * A configuração de SMTP, editada pelo administrativo geral.
 *
 * Uma global, do produto, e opcionalmente uma por prefeitura. Trocar de
 * provedor, corrigir porta ou girar senha deixou de exigir acesso à VPS.
 */
export class GerenciarEmail {
  constructor(
    private readonly configuracoes: ConfiguracaoEmailRepository,
    private readonly enviador: EnviadorDeEmail,
    private readonly auditoria: AuditoriaRepository,
  ) {}

  /**
   * O que a tela recebe — **sem a senha**, nem cifrada.
   *
   * Cifrada ela não é legível, mas continua sendo o material que a
   * `EMAIL_CHAVE` abre, e uma tela que a carrega no HTML a deixa no cache do
   * navegador, no histórico do DevTools e em qualquer print. `temSenha` é tudo
   * o que a tela precisa para desenhar "configurada" ou o campo vazio.
   */
  ver = async (orgaoId: string | null): Promise<ConfiguracaoNaTela | null> => {
    const configuracao = await this.configuracoes.buscar(orgaoId);
    if (!configuracao) return null;

    const { senhaCifrada, ...resto } = configuracao;
    return { ...resto, temSenha: senhaCifrada !== null };
  };

  salvar = async (
    orgaoId: string | null,
    dados: DadosDaTela,
    administradorId: string,
  ): Promise<void> => {
    this.conferir(dados);

    const existente = await this.configuracoes.buscar(orgaoId);

    /**
     * Credencial é par: usuário e senha, ou nenhum dos dois.
     *
     * O banco recusa metade — e recusaria com um erro de constraint, que não
     * diz a quem está na tela o que fazer. Aqui a recusa tem frase.
     */
    const usuario = dados.usuario?.trim() || null;
    const senhaNova = dados.senha === null ? null : dados.senha?.trim() || undefined;

    if (usuario && senhaNova === undefined && !existente?.senhaCifrada) {
      throw new ErroDeNegocio(
        "Informe a senha do SMTP junto com o usuário. Servidor que não pede "
        + "autenticação deve ficar com os dois campos em branco.",
      );
    }
    if (!usuario && senhaNova) {
      throw new ErroDeNegocio(
        "Informe o usuário do SMTP junto com a senha, ou deixe os dois em branco.",
      );
    }

    await this.configuracoes.salvar(orgaoId, {
      host: dados.host.trim(),
      porta: dados.porta,
      usuario,
      // `undefined` mantém a que está lá; `null` remove a autenticação.
      senhaCifrada: usuario
        ? (senhaNova === undefined || senhaNova === null
          ? undefined
          : cifrar(senhaNova, chaveDoAmbiente()))
        : null,
      remetente: dados.remetente.trim(),
      tlsDireto: dados.tlsDireto,
      ativo: dados.ativo,
    }, administradorId);

    /**
     * A trilha é por prefeitura, e a configuração global não é de nenhuma.
     *
     * `auditoria` exige `orgaoId` — a tabela é multi-tenant e toda leitura
     * filtra por ele. Escrever a mudança global na trilha de uma prefeitura
     * qualquer seria mentira, e escrever em todas seria ruído. **Limitação
     * conhecida:** a alteração do SMTP do produto não fica na auditoria; quem
     * mexe nela são os administradores gerais, que são poucos e nomeados.
     * Resolver isso pede uma trilha própria do produto, que não foi modelada.
     */
    if (orgaoId) {
      await this.auditoria.registrar({
        orgaoId,
        usuarioId: administradorId,
        tipoEvento: "EMAIL_CONFIGURADO",
        detalhes: {
          host: dados.host.trim(),
          porta: dados.porta,
          remetente: dados.remetente.trim(),
          ativo: dados.ativo,
          // A senha nunca entra no detalhe: auditoria é lida por gente, e o
          // registro fica para sempre.
          senhaTrocada: senhaNova !== undefined,
        },
      });
    }
  };

  remover = async (orgaoId: string | null, administradorId: string): Promise<void> => {
    const existente = await this.configuracoes.buscar(orgaoId);
    if (!existente) throw new NaoEncontrado("Não há configuração de e-mail para remover");

    await this.configuracoes.remover(orgaoId);
    // Mesma razão do `salvar`: a global não tem prefeitura a que pertencer.
    if (orgaoId) {
      await this.auditoria.registrar({
        orgaoId,
        usuarioId: administradorId,
        tipoEvento: "EMAIL_CONFIGURACAO_REMOVIDA",
        detalhes: { host: existente.host },
      });
    }
  };

  /**
   * Envio de teste, fora da fila.
   *
   * Configuração de SMTP sem botão de testar se descobre errada no dia em que
   * um cidadão precisava do aviso. Vai direto, na hora, e o erro do servidor
   * sobe como veio — "535 authentication failed" diz o que corrigir; "falha no
   * envio" não diz nada.
   *
   * Usa a configuração **que está no banco**, e não a do formulário: testar o
   * que foi digitado e gravar outra coisa seria testar o que não vai valer.
   */
  testar = async (
    orgaoId: string | null,
    paraOnde: string,
    nomeDoOrgao: string,
  ): Promise<void> => {
    if (!enderecoValido(paraOnde)) {
      throw new ErroDeNegocio("Informe um e-mail válido para receber o teste.");
    }

    const configuracao = await this.configuracoes.buscar(orgaoId);
    if (!configuracao) {
      throw new NaoEncontrado("Salve a configuração antes de testar o envio.");
    }

    const senha = configuracao.senhaCifrada
      ? decifrar(configuracao.senhaCifrada, chaveDoAmbiente())
      : null;

    try {
      await this.enviador.enviar(
        {
          host: configuracao.host,
          porta: configuracao.porta,
          usuario: configuracao.usuario,
          senha,
          tlsDireto: configuracao.tlsDireto,
        },
        {
          remetente: remetenteComNome(nomeDoOrgao, configuracao.remetente),
          destinatario: paraOnde,
          assunto: "Teste de envio",
          corpo: [
            "Este é um teste de envio do sistema de procedimentos administrativos.",
            "",
            "Se você recebeu esta mensagem, o SMTP está configurado corretamente e",
            "os avisos do sistema vão chegar aos destinatários.",
            "",
            "--",
            nomeDoOrgao,
            "Mensagem automática: não responda a este e-mail, a caixa não é lida.",
          ].join("\n"),
        },
      );
    } catch (erro) {
      throw new ErroDeNegocio(
        `O servidor de e-mail recusou o envio: ${
          erro instanceof Error ? erro.message : String(erro)
        }`,
      );
    }
  };

  private conferir = (dados: DadosDaTela): void => {
    if (!dados.host.trim()) throw new ErroDeNegocio("Informe o servidor de SMTP.");
    if (!Number.isInteger(dados.porta) || dados.porta < 1 || dados.porta > 65535) {
      throw new ErroDeNegocio("A porta do SMTP precisa estar entre 1 e 65535.");
    }
    if (!enderecoValido(dados.remetente)) {
      throw new ErroDeNegocio("O remetente precisa ser um endereço de e-mail válido.");
    }
  };
}
