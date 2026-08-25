import { WorkspaceShell } from "@/shared/workspace/WorkspaceShell";

export default function ProtocoloLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell workspaceId="protocolo">{children}</WorkspaceShell>;
}
