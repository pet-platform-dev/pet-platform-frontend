import { z } from "zod";
import { notFound } from "next/navigation";
import { RequireAdmin } from "@/features/admin/moderation/require-admin";
import { AdminConversationContext } from "@/features/reports/admin-conversation-context";
export const metadata = {
  title: "Контекст скарги — Лапа",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return (
    <main className="catalog-shell">
      <RequireAdmin
        returnTo={"/admin/moderation/reports/" + id + "/conversation"}
      >
        <AdminConversationContext id={id} />
      </RequireAdmin>
    </main>
  );
}
