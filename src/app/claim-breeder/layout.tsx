import { ClaimSession } from "@/features/breeder/claim/claim-session";
import "@/features/breeder/claim/claim.css";
export default function ClaimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClaimSession>{children}</ClaimSession>;
}
