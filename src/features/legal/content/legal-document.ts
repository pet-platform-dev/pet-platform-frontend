export type LegalSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

// Revision identity mirrors the backend registry; release checks reject drift.
export type LegalDocument = {
  slug: "privacy" | "terms";
  version: string;
  title: string;
  description: string;
  status: "development-draft";
  privacyContact?:
    | { status: "UNAVAILABLE"; email: null }
    | { status: "VERIFIED"; email: string };
  sections: readonly LegalSection[];
};
