/**
 * Catálogo de papéis, em um lugar só. Antes a lista estava repetida em cada
 * schema Zod, e um papel novo (FROTAS) entrou no banco e no front mas ficou de
 * fora da validação — o cadastro morria com "invalid enum value".
 *
 * Ao acrescentar um papel: incluir aqui **e** na constraint `usuario_papel_base_check`
 * via migration.
 */
export const PAPEIS = [
  "ADMIN",
  "GESTOR",
  "SERVIDOR",
  "PROTOCOLO",
  "COMPRAS",
  "CONTROLADORIA",
  "NUTRICIONISTA",
  // A escola, a creche, o posto: quem recebe material e responde por ele.
  "UNIDADE",
  "PATRIMONIO",
  "FROTAS",
] as const;

export type Papel = (typeof PAPEIS)[number];

export const TIPOS_DE_SETOR = [
  "PROTOCOLO",
  "COMPRAS",
  "CONTROLADORIA",
  "ALIMENTACAO_ESCOLAR",
  "FROTAS",
  "PATRIMONIO",
  "OPERACIONAL",
] as const;

export type TipoDeSetor = (typeof TIPOS_DE_SETOR)[number];

export const ehTipoDeSetor = (valor: string): valor is TipoDeSetor =>
  (TIPOS_DE_SETOR as readonly string[]).includes(valor);
