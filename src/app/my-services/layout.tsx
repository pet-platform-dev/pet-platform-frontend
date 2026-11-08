import { WorkspaceShell } from "@/features/services/workspace/shell";
import { WorkspaceSession } from "@/features/services/workspace/session";
import "@/features/services/services.css";
import "@/features/services/workspace/workspace.css";
export const metadata = {
  title: "Мої послуги — Лапа",
  robots: { index: false, follow: false },
};
export default function ServicesWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceSession>
      <WorkspaceShell>{children}</WorkspaceShell>
    </WorkspaceSession>
  );
}
