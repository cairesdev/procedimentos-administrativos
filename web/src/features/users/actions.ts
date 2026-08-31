"use server";

import { revalidatePath } from "next/cache";
import { apiRequest } from "@/shared/api/http-client";
import { endpoints } from "@/shared/api/endpoints";
import { runAction } from "@/shared/api/action-result";
import { userSchema, type UserInput } from "./schemas";

/**
 * `"escola:<uuid>"` vira `{ localId }`, e assim por diante.
 *
 * O select guarda tipo e id numa string só porque um `<select>` devolve um
 * valor, não dois.
 */
const lotacaoDe = (destino?: string) => {
  const [tipo, id] = (destino ?? "").split(":");
  if (!id) return [];
  if (tipo === "unidade") return [{ unidadeId: id }];
  if (tipo === "escola") return [{ localId: id }];
  return [{ setorId: id }];
};

export const createUser = async (input: UserInput) =>
  runAction(async () => {
    const { destino, ...user } = userSchema.parse(input);
    await apiRequest(endpoints.users, {
      method: "POST",
      body: { ...user, lotacoes: lotacaoDe(destino) },
    });
    revalidatePath("/administracao/usuarios");
  }, "Usuário cadastrado");

export const updateUser = async (id: string, input: UserInput) =>
  runAction(async () => {
    const parsed = userSchema.parse(input);
    const { destino, username: _username, senha, ...user } = parsed;
    await apiRequest(`${endpoints.users}/${id}`, {
      method: "PATCH",
      body: senha ? { ...user, senha } : user,
    });

    /**
     * A lotação só era gravada na criação.
     *
     * Quem cadastrasse a diretora na escola errada não tinha como consertar
     * pela tela — e é a lotação que decide o que ela enxerga. Só grava quando
     * a tela informou alguma: em branco quer dizer "não mexi nisso", e
     * apagaria o vínculo de quem só veio trocar o e-mail.
     */
    if (destino) {
      await apiRequest(`${endpoints.users}/${id}/lotacoes`, {
        method: "PUT",
        body: { lotacoes: lotacaoDe(destino) },
      });
    }
    revalidatePath("/administracao/usuarios");
  }, "Usuário atualizado");

export const setUserActive = async (id: string, active: boolean) =>
  runAction(async () => {
    await apiRequest(`${endpoints.users}/${id}`, { method: "PATCH", body: { ativo: active } });
    revalidatePath("/administracao/usuarios");
  }, active ? "Usuário reativado" : "Usuário inativado");

export const deleteUser = async (id: string) =>
  runAction(async () => {
    await apiRequest(`${endpoints.users}/${id}`, { method: "DELETE" });
    revalidatePath("/administracao/usuarios");
  }, "Usuário excluído");
