import type { Metadata } from "next";
import { LegalDocumentPage } from "@/features/legal/legal-document-page";
import { termsDocument } from "@/features/legal/content/terms";

export const metadata: Metadata = {
  title: `${termsDocument.title} — Лапа`,
  description: termsDocument.description,
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return <LegalDocumentPage document={termsDocument} />;
}
