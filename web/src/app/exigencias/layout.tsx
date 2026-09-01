import type { ReactNode } from "react";

/** Sem a casca do sistema: quem abre esta página não tem conta nem módulo. */
export default function ChecklistPublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
