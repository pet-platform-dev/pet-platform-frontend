import type { Metadata } from "next";
import { LegalDocumentPage } from "@/features/legal/legal-document-page";
import { termsDocument } from "@/features/legal/content/terms";
import { privacyDocument } from "@/features/legal/content/privacy";
import { legalPageMetadata } from "@/features/legal/legal-page-metadata";

export const metadata: Metadata = legalPageMetadata(termsDocument);

export default function TermsPage() {
  return (
    <LegalDocumentPage
      document={termsDocument}
      contact={privacyDocument.privacyContact}
    />
  );
}
