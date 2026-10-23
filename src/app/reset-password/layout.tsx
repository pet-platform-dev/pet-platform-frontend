import { ResetSession } from "@/features/auth/password-recovery/reset-session";
export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ResetSession>{children}</ResetSession>;
}
