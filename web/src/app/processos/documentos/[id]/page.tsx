import { permanentRedirect } from "next/navigation";

/**
 * A tela do documento saiu de dentro de Processos (ver /documentos/[id]).
 * Este redirect existe porque o endereço antigo pode estar impresso, salvo nos
 * favoritos de alguém ou colado num e-mail — e quebrar link de peça oficial é
 * pior que manter três linhas de código.
 */
export default async function DocumentoMovido(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  permanentRedirect(`/documentos/${id}?voltar=/processos/fila`);
}
