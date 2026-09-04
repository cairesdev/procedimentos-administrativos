/**
 * O SMTP que atende cada prefeitura.
 *
 * Uma configuração global, do produto, e opcionalmente uma da prefeitura. A
 * resolução é a mesma de `documento_modelo`: vale a da prefeitura quando existe
 * e está ativa, senão a global. Quem tem domínio próprio manda do domínio
 * próprio; quem não tem funciona no primeiro dia sem configurar nada.
 */

export type ConfiguracaoDeEmail = {
  id: string;
  /** Nulo = a configuração do produto. */
  orgaoId: string | null;
  host: string;
  porta: number;
  usuario: string | null;
  /** Pacote AES-GCM em base64. **Nunca** sai da API — ver `ConfiguracaoNaTela`. */
  senhaCifrada: string | null;
  remetente: string;
  tlsDireto: boolean;
  ativo: boolean;
  atualizadoEm: string;
};

/** Qual das duas venceu — a tela precisa dizer de onde veio o que está valendo. */
export type ConfiguracaoResolvida = ConfiguracaoDeEmail & {
  origem: "GLOBAL" | "PREFEITURA";
};

/**
 * O que a tela recebe.
 *
 * A senha não sai da API em resposta nenhuma, nem cifrada. Cifrada ela não é
 * legível, mas continua sendo o material que a `EMAIL_CHAVE` abre — e uma tela
 * que a carrega no HTML a deixa no cache do navegador, no histórico do
 * DevTools e em qualquer print. `temSenha` é tudo o que a tela precisa saber
 * para desenhar "configurada" ou o campo vazio.
 */
export type ConfiguracaoNaTela = Omit<ConfiguracaoDeEmail, "senhaCifrada"> & {
  temSenha: boolean;
};

export type DadosDaConfiguracao = {
  host: string;
  porta: number;
  usuario?: string | null;
  /**
   * Já cifrada pelo caso de uso.
   *
   * `undefined` significa "não mexe na que está lá" — é o campo em branco no
   * formulário de edição, que não pode apagar a senha de quem só quis corrigir
   * a porta. `null` é o pedido explícito de remover a autenticação.
   */
  senhaCifrada?: string | null;
  remetente: string;
  tlsDireto: boolean;
  ativo: boolean;
};

export interface ConfiguracaoEmailRepository {
  /** A que vale para este órgão: a dele, senão a global, senão nenhuma. */
  resolver(orgaoId: string): Promise<ConfiguracaoResolvida | null>;
  /** A linha exata, para a tela editar. `null` no órgão busca a global. */
  buscar(orgaoId: string | null): Promise<ConfiguracaoDeEmail | null>;
  /** Cria ou substitui a do órgão (ou a global, com `null`). */
  salvar(
    orgaoId: string | null,
    dados: DadosDaConfiguracao,
    atualizadoPor: string,
  ): Promise<void>;
  remover(orgaoId: string | null): Promise<void>;
}
