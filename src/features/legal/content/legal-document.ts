export type LegalSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

// Content identity and review state only. Canonical versions/effective dates and
// acceptance evidence belong to the future backend, not a frontend registry.
export type LegalDocument = {
  slug: "privacy" | "terms";
  title: string;
  description: string;
  status: "development-draft";
  sections: readonly LegalSection[];
};
