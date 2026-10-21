import type { Metadata } from "next";
import { LegalDocumentPage } from "@/features/legal/legal-document-page";
import { privacyDocument } from "@/features/legal/content/privacy";
import { legalPageMetadata } from "@/features/legal/legal-page-metadata";

export const metadata: Metadata = legalPageMetadata(privacyDocument);

export default function PrivacyPage() {
  return <LegalDocumentPage document={privacyDocument} />;
}
