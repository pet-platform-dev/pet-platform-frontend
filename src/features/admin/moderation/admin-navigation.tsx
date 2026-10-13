import Link from "next/link";
import type { User } from "@/entities/user/model";
export function AdminNavigation({ user }: { user: Pick<User, "role"> }) {
  if (user.role !== "ADMIN") return null;
  return (
    <section className="dashboard-card">
      <h2>Модерація</h2>
      <p>Перевіряйте матеріали перед публікацією.</p>
      <Link
        className="button secondary"
        href="/admin/moderation"
        prefetch={false}
      >
        Модерація
      </Link>
      <Link
        className="button secondary"
        href="/admin/moderation/reports"
        prefetch={false}
      >
        Скарги
      </Link>
    </section>
  );
}
