/**
 * A partir de quantos dias restantes a etapa entra em alerta na fila.
 *
 * Fonte única: a API conta os processos em alerta (a fila é paginada, contar
 * no cliente contaria só a página) e devolve este número junto, para o front
 * pintar a linha com o mesmo critério. Duas cópias da constante já causaram
 * divergência antes — ver o caso do `papelBase` no roadmap.
 */
export const LIMIAR_ALERTA_DIAS = 2;
