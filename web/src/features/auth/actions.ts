"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { loginSchema, type LoginInput } from "./schemas";
import type { ActionResult } from "@/shared/ui/use-resource-form";

export const authenticate = async (
  input: LoginInput,
  callbackUrl = "/",
): Promise<ActionResult> => {
  const credentials = loginSchema.parse(input);
  try {
    await signIn("credentials", { ...credentials, redirectTo: callbackUrl });
    return { success: "Autenticado" };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Usuário ou senha inválidos" };
    }
    throw error;
  }
};

export const logout = async () => {
  await signOut({ redirectTo: "/login" });
};
