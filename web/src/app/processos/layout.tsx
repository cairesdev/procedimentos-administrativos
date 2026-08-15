import { WorkspaceShell } from "@/shared/workspace/WorkspaceShell";

export default function ProcessosLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell workspaceId="processos">{children}</WorkspaceShell>;
}
