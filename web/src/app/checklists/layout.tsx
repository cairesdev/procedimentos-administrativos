import { WorkspaceShell } from "@/shared/workspace/WorkspaceShell";

export default function CheckListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceShell workspaceId="checklist">{children}</WorkspaceShell>;
}
