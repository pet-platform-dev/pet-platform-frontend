import { notFound } from "next/navigation";
import { z } from "zod";
import { RequireAdmin } from "@/features/admin/moderation/require-admin";
import { ModerationDetailShell } from "@/features/admin/moderation/detail-shell";
import {
  contentTypeFromSegment,
  safeQueueReturn,
  detailHref,
} from "@/features/admin/moderation/navigation";
export const metadata = {
  title: "Перевірка матеріалу — Лапа",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const route = await params,
    type = contentTypeFromSegment(route.type);
  if (!type || !z.uuid().safeParse(route.id).success) notFound();
  const returnTo = safeQueueReturn((await searchParams).returnTo);
  return (
    <main className="catalog-shell">
      <RequireAdmin returnTo={detailHref(type, route.id, returnTo)}>
        <ModerationDetailShell
          key={type + route.id}
          type={type}
          id={route.id}
          returnTo={returnTo}
        />
      </RequireAdmin>
    </main>
  );
}
