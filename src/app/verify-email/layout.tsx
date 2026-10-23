import { ConfirmationSession } from "@/features/auth/email-verification/confirmation-session";

export default function VerifyEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConfirmationSession>{children}</ConfirmationSession>;
}
