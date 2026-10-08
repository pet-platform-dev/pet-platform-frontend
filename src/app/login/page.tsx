import { AuthForm } from "@/features/auth/auth-form";
export const metadata = { title: "Увійти — Лапа" };
export default function LoginPage() {
  return (
    <main className="page-shell">
      <AuthForm mode="login" />
    </main>
  );
}
