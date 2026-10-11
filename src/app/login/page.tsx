import { AuthForm } from "@/features/auth/auth-form";
export const metadata = { title: "Увійти — Лапа" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <main className="page-shell">
      <AuthForm mode="login" returnTo={query.returnTo} />
    </main>
  );
}
