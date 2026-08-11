import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { apiBaseUrl } from "@/shared/api/http-client";
import type { LoginResponse, Profile } from "@/features/auth/types";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        identificador: { label: "Usuário ou e-mail" },
        senha: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const response = await fetch(`${apiBaseUrl}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identificador: credentials?.identificador,
            senha: credentials?.senha,
          }),
        });
        if (!response.ok) return null;

        const { token } = (await response.json()) as LoginResponse;

        // O perfil traz órgão, papel e módulos habilitados — o middleware
        // decide as rotas a partir daí, sem nova ida à API.
        const profileResponse = await fetch(`${apiBaseUrl}/auth/eu`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!profileResponse.ok) return null;
        const profile = (await profileResponse.json()) as Profile;

        return {
          id: profile.id,
          name: profile.nome,
          email: profile.email,
          accessToken: token,
          role: profile.papelBase,
          orgId: profile.orgaoId,
          orgName: profile.orgaoNome,
          modules: profile.modulos,
        };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.accessToken = user.accessToken;
        token.role = user.role;
        token.orgId = user.orgId;
        token.orgName = user.orgName;
        token.modules = user.modules;
      }
      return token;
    },
    session: ({ session, token }) => {
      session.accessToken = token.accessToken;
      session.user.id = token.sub ?? session.user.id;
      session.user.role = token.role;
      session.user.orgId = token.orgId;
      session.user.orgName = token.orgName;
      session.user.modules = token.modules;
      return session;
    },
  },
});
