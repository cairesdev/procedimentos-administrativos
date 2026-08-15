import { WorkspaceShell } from "@/shared/workspace/WorkspaceShell";

export default function AdministracaoLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell workspaceId="administracao">{children}</WorkspaceShell>;
}
