import { WorkspaceShell } from "@/shared/workspace/WorkspaceShell";

export default function SaudeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceShell workspaceId="saude">{children}</WorkspaceShell>;
}
