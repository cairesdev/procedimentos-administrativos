import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { workspaces } from "../src/shared/auth/modules.ts";
import { hasPermission } from "../src/shared/auth/permissions.ts";
import { ROLES } from "../src/features/users/types.ts";

/**
 * Link de menu que ninguém alcança.
 *
 * Para o link aparecer, a pessoa precisa de **duas** permissões: a do sistema
 * (para entrar nele) e a do link (para vê-lo dentro). Quando as duas não cabem
 * no mesmo papel, o link existe, a tela existe, e não há quem chegue nela.
 *
 * Foi o que aconteceu com o cadastro das unidades de saúde: ele morava em
 * `/saude`, cuja porta é `health:read`, e a única permissão que o abre é
 * `health:manage` — do ADMIN, que deliberadamente não tem permissão clínica
 * nenhuma. A tela ficou inalcançável para a única pessoa que podia usá-la, e
 * nada acusou: o typecheck não sabe de permissão, e o guarda de telas da API
 * confere se a página aguenta as rotas que chama, não se alguém consegue abrir
 * a página.
 *
 * O conserto foi mudar a tela de sistema. O que ficou é esta conferência.
 */

describe("todo link do menu tem dono", () => {
  const links = workspaces.flatMap((workspace) =>
    workspace.sections.flatMap((section) =>
      section.links.map((link) => ({ workspace, section, link }))));

  it("acha os links", () => {
    assert.ok(links.length > 20, `só ${links.length} links — a varredura falhou`);
  });

  for (const { workspace, section, link } of links) {
    it(`${workspace.name} → ${link.label}`, () => {
      const donos = ROLES.filter((papel) => (
        hasPermission(papel, workspace.permission) && hasPermission(papel, link.permission)
      ));

      assert.ok(
        donos.length > 0,
        `nenhum papel tem "${workspace.permission}" (entrar em ${workspace.name}) `
        + `e "${link.permission}" (ver ${link.label}) ao mesmo tempo — `
        + `${link.href} é inalcançável pelo menu. Está no sistema errado, ou `
        + "falta alguém na matriz de permissões.",
      );
      assert.ok(section.links.length > 0);
    });
  }
});
