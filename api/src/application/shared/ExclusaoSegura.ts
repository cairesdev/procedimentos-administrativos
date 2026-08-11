import { ErroDeNegocio, NaoEncontrado } from "../../domain/shared/ErroDeNegocio";

// Regra de exclusão do sistema: inativar é o caminho normal; apagar de vez
// só é permitido quando o registro nunca foi usado. Vínculo existente vira
// 422 com a contagem, para a tela explicar o que impede.
export const garantirSemVinculos = (
  vinculos: Record<string, number>,
  entidade: string,
): void => {
  const total = Object.values(vinculos).reduce((soma, quantidade) => soma + quantidade, 0);
  if (total === 0) return;

  const descricao = Object.entries(vinculos)
    .map(([tipo, quantidade]) => `${quantidade} ${tipo.replace(/_/g, " ")}`)
    .join(", ");

  throw new ErroDeNegocio(
    `${entidade} tem vínculos (${descricao}). Inative em vez de excluir.`,
    422,
    vinculos,
  );
};

export const garantirExiste = <T>(registro: T | null, entidade: string): T => {
  if (!registro) throw new NaoEncontrado(`${entidade} não encontrado`);
  return registro;
};
