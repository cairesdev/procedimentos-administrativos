import type { DefaultSession } from "next-auth";
import type { ModuleName, Role } from "@/features/auth/types";

declare module "next-auth" {
  interface User {
    accessToken: string;
    role: Role;
    orgId: string;
    orgName: string;
    modules: ModuleName[];
  }

  interface Session {
    accessToken: string;
    user: {
      id: string;
      role: Role;
      orgId: string;
      orgName: string;
      modules: ModuleName[];
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken: string;
    role: Role;
    orgId: string;
    orgName: string;
    modules: ModuleName[];
  }
}

export {};
