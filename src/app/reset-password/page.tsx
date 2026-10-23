import type { Metadata } from "next";
import { ResetPassword } from "@/features/auth/password-recovery/reset-password";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Новий пароль — Лапа",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function ResetPasswordPage() {
  return (
    <main className="page-shell">
      <ResetPassword />
    </main>
  );
}
