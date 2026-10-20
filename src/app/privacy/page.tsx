import type { Metadata } from "next";
import { LegalDocumentPage } from "@/features/legal/legal-document-page";
import { privacyDocument } from "@/features/legal/content/privacy";

export const metadata: Metadata = {
  title: `${privacyDocument.title} — Лапа`,
  description: privacyDocument.description,
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return <LegalDocumentPage document={privacyDocument} />;
}
