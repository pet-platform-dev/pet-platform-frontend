import { Account } from "@/features/auth/account";
export const metadata = { title: "Мій профіль — Лапа" };
export default function AccountPage() {
  return (
    <main className="catalog-shell">
      <Account />
    </main>
  );
}
