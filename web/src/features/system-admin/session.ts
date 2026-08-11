import { cookies } from "next/headers";

export const ADMIN_COOKIE = "admin_sessao";

export const readAdminToken = async (): Promise<string | undefined> =>
  (await cookies()).get(ADMIN_COOKIE)?.value;

export const writeAdminToken = async (token: string): Promise<void> => {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
};

export const clearAdminToken = async (): Promise<void> => {
  (await cookies()).delete(ADMIN_COOKIE);
};
