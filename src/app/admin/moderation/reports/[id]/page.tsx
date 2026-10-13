import { z } from "zod";
import { notFound } from "next/navigation";
import { RequireAdmin } from "@/features/admin/moderation/require-admin";
import { AdminReportDetail } from "@/features/reports/admin-detail";
import {
  safeReportsReturn,
  reportDetailHref,
} from "@/features/reports/navigation";
export const metadata = {
  title: "Перевірка скарги — Лапа",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const returnTo = safeReportsReturn((await searchParams).returnTo);
  return (
    <main className="catalog-shell">
      <RequireAdmin returnTo={reportDetailHref(id, returnTo)}>
        <AdminReportDetail id={id} returnTo={returnTo} />
      </RequireAdmin>
    </main>
  );
}
