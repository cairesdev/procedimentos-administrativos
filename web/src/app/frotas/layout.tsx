import { WorkspaceShell } from "@/shared/workspace/WorkspaceShell";

export default function FrotasLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell workspaceId="frotas">{children}</WorkspaceShell>;
}
