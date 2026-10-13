import { RequireAdmin } from "@/features/admin/moderation/require-admin";
import { AdminReportQueue } from "@/features/reports/admin-queue";
import { parseReportsState, reportsHref } from "@/features/reports/navigation";
export const metadata = {
  title: "Скарги — Лапа",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = parseReportsState(await searchParams);
  return (
    <main className="catalog-shell">
      <RequireAdmin returnTo={reportsHref(state)}>
        <AdminReportQueue state={state} />
      </RequireAdmin>
    </main>
  );
}
