import { Suspense } from "react";
import { AdminShell } from "@/features/admin/dashboard/shell";
import "@/features/admin/dashboard/dashboard.css";
import "@/features/auth/account-dashboard.css";
import "@/features/admin/moderation/moderation.css";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="status-panel" role="status">
          Перевіряємо сесію…
        </div>
      }
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
