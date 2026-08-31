import type { ReactNode } from "react";

/** Sem a casca do sistema: quem abre esta página não tem conta nem módulo. */
export default function SupplierPublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
