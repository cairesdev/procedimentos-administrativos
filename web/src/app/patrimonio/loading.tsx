import { SkeletonTable } from "@/shared/ui/Skeleton";

/**
 * O que aparece enquanto a tela vem do servidor.
 *
 * As páginas são server components: sem isto, o clique não produz nada até a
 * resposta chegar, e quem está do outro lado clica de novo. O esqueleto tem a
 * forma de uma listagem porque é o que a maioria destas rotas é.
 */
export default function Carregando() {
  return <SkeletonTable />;
}
