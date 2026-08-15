import { WorkspaceShell } from "@/shared/workspace/WorkspaceShell";

export default function PatrimonioLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell workspaceId="patrimonio">{children}</WorkspaceShell>;
}
