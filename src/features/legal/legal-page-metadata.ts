import type { Metadata } from "next";
import type { LegalDocument } from "./content/legal-document";

export function legalPageMetadata(document: LegalDocument): Metadata {
  return {
    title: `${document.title} — Лапа`,
    description: document.description,
    robots: { index: document.status === "published", follow: true },
  };
}
