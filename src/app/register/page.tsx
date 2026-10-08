import { AuthForm } from "@/features/auth/auth-form";
export const metadata = { title: "Реєстрація — Лапа" };
export default function RegisterPage() {
  return (
    <main className="page-shell">
      <AuthForm mode="register" />
    </main>
  );
}
