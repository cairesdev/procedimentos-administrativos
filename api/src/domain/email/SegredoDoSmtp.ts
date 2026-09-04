import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ErroDeNegocio } from "../shared/ErroDeNegocio";

/**
 * A senha do SMTP, cifrada para dormir no banco.
 *
 * A configuração de e-mail saiu do `.env` e foi para uma tela do administrativo
 * geral — trocar de provedor ou girar a senha deixou de exigir acesso à VPS.
 * O preço é que a credencial passa a viver numa tabela, e o backup diário do
 * compose passa a carregá-la junto. Uma senha de SMTP vazada é a capacidade de
 * mandar e-mail em nome da prefeitura, para os endereços que o próprio sistema
 * conhece; este projeto já perdeu segredo por vazamento uma vez.
 *
 * **O que esta cifra protege:** dump do banco, backup vazado, réplica de
 * leitura, print de uma consulta. **O que ela não protege:** invasão do
 * servidor — quem entra na VPS tem o banco e o `.env` juntos. Dizer o
 * contrário seria vender segurança que não existe.
 *
 * AES-256-GCM porque é autenticado: linha adulterada falha alto, na hora de
 * decifrar, em vez de devolver lixo que seguiria para o servidor de e-mail
 * como se fosse senha. Sem dependência nova — `node:crypto` basta.
 */

const ALGORITMO = "aes-256-gcm";
const BYTES_DO_NONCE = 12;
const BYTES_DA_TAG = 16;

/**
 * A chave, lida do ambiente.
 *
 * São 32 bytes em base64 — `openssl rand -base64 32`. Fica no `.env.prod`,
 * com `chmod 600`, e **não** no `.env.prod.example`: segredo em arquivo de
 * exemplo é segredo queimado, que é como os anteriores se perderam.
 *
 * Perder a chave significa recadastrar as senhas na tela. Não há recuperação,
 * e é assim mesmo: uma cifra da qual se recupera o texto sem a chave não é
 * cifra.
 */
export const chaveDoAmbiente = (bruta = process.env.EMAIL_CHAVE): Buffer => {
  if (!bruta) {
    throw new ErroDeNegocio(
      "EMAIL_CHAVE não está configurada, e sem ela a senha do SMTP não pode ser "
      + "guardada nem lida. Gere uma com `openssl rand -base64 32` e ponha no .env.",
      500,
    );
  }

  const chave = Buffer.from(bruta, "base64");
  if (chave.length !== 32) {
    /**
     * O tamanho é conferido aqui, e não na primeira mensagem que não sai.
     *
     * `Buffer.from(..., "base64")` não reclama de entrada inválida: ele
     * descarta o que não reconhece e devolve um buffer curto. Uma chave de
     * dezoito bytes passaria pelo cadastro e explodiria semanas depois, no
     * meio de um envio, com uma mensagem do OpenSSL que não diz nada a quem
     * for ler o log.
     */
    throw new ErroDeNegocio(
      `EMAIL_CHAVE precisa ter 32 bytes em base64 e tem ${chave.length}. `
      + "Gere outra com `openssl rand -base64 32`.",
      500,
    );
  }
  return chave;
};

/** Nonce + tag + conteúdo, num base64 só — é o que vai para a coluna. */
export const cifrar = (senha: string, chave: Buffer): string => {
  const nonce = randomBytes(BYTES_DO_NONCE);
  const cifrador = createCipheriv(ALGORITMO, chave, nonce);
  const conteudo = Buffer.concat([cifrador.update(senha, "utf8"), cifrador.final()]);
  return Buffer.concat([nonce, cifrador.getAuthTag(), conteudo]).toString("base64");
};

export const decifrar = (pacote: string, chave: Buffer): string => {
  const bytes = Buffer.from(pacote, "base64");
  if (bytes.length <= BYTES_DO_NONCE + BYTES_DA_TAG) {
    throw new ErroDeNegocio(
      "A senha do SMTP guardada está truncada. Cadastre-a de novo na tela de e-mail.",
      500,
    );
  }

  const nonce = bytes.subarray(0, BYTES_DO_NONCE);
  const tag = bytes.subarray(BYTES_DO_NONCE, BYTES_DO_NONCE + BYTES_DA_TAG);
  const conteudo = bytes.subarray(BYTES_DO_NONCE + BYTES_DA_TAG);

  const decifrador = createDecipheriv(ALGORITMO, chave, nonce);
  decifrador.setAuthTag(tag);

  try {
    return decifrador.update(conteudo) + decifrador.final("utf8");
  } catch {
    /**
     * Chave trocada ou linha adulterada — e não dá para saber qual.
     *
     * O GCM só responde "não confere". A mensagem diz as duas possibilidades
     * porque quem lê o log precisa das duas: trocar `EMAIL_CHAVE` sem
     * recadastrar é o erro provável, e adulteração é o que a cifra existe
     * para pegar. O erro original não é repassado: ele não acrescenta nada e
     * arrisca carregar bytes do conteúdo.
     */
    throw new ErroDeNegocio(
      "A senha do SMTP não pôde ser lida: ou a EMAIL_CHAVE mudou, ou a linha foi "
      + "alterada por fora. Cadastre a senha de novo na tela de e-mail.",
      500,
    );
  }
};
