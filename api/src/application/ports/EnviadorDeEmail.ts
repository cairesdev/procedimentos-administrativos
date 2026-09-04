export type EmailAEnviar = {
  /** Já montado com o nome da prefeitura: `"Prefeitura de X" <endereco>`. */
  remetente: string;
  destinatario: string;
  assunto: string;
  corpo: string;
};

export type ConfiguracaoDeEnvio = {
  host: string;
  porta: number;
  usuario: string | null;
  /** Em texto, já decifrada — nunca a coluna do banco. */
  senha: string | null;
  tlsDireto: boolean;
};

/**
 * Quem coloca a mensagem no fio.
 *
 * A configuração vem por parâmetro, e não do construtor, porque cada e-mail
 * pode sair por um SMTP diferente: a prefeitura com domínio próprio manda pelo
 * dela, as outras pelo do produto. Um transporte fixo obrigaria a subir um
 * worker por prefeitura.
 */
export interface EnviadorDeEmail {
  enviar(configuracao: ConfiguracaoDeEnvio, email: EmailAEnviar): Promise<void>;
}
