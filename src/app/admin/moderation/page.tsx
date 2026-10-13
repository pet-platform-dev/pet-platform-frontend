import { RequireAdmin } from "@/features/admin/moderation/require-admin";
import { ModerationQueuePage } from "@/features/admin/moderation/queue";
import {
  parseQueueState,
  queueHref,
} from "@/features/admin/moderation/navigation";
export const metadata = {
  title: "Модерація — Лапа",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = parseQueueState(await searchParams);
  return (
    <main className="catalog-shell">
      <RequireAdmin returnTo={queueHref(state)}>
        <ModerationQueuePage state={state} />
      </RequireAdmin>
    </main>
  );
}
