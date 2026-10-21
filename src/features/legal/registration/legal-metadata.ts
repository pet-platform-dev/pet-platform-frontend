import { z } from "zod";
import { publicRequest, ApiError } from "@/shared/api/client";
import { legalContentIdentity } from "../content/content-integrity";

const revision = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
const document = z.strictObject({
  kind: z.enum(["TERMS", "PRIVACY"]),
  version: revision,
  status: z.enum(["DRAFT", "PUBLISHED"]),
  effectiveAt: z.iso.datetime().nullable(),
  path: z.enum(["/terms", "/privacy"]),
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
const metadataSchema = z
  .strictObject({
    acceptanceRequired: z.boolean(),
    terms: document,
    privacy: document,
  })
  .refine((data) => {
    if (
      data.terms.kind !== "TERMS" ||
      data.terms.path !== "/terms" ||
      data.privacy.kind !== "PRIVACY" ||
      data.privacy.path !== "/privacy"
    )
      return false;
    return [data.terms, data.privacy].every((doc) =>
      data.acceptanceRequired
        ? doc.status === "PUBLISHED" &&
          doc.effectiveAt !== null &&
          new Date(doc.effectiveAt).getTime() <= Date.now()
        : doc.status === "DRAFT" && doc.effectiveAt === null,
    );
  });
export type LegalMetadata = z.infer<typeof metadataSchema>;
export type LegalContentIdentity = Record<
  "terms" | "privacy",
  Pick<
    LegalMetadata["terms"],
    "kind" | "version" | "status" | "path" | "contentDigest"
  >
>;
export type LegalAcceptance = {
  accepted: true;
  termsVersion: string;
  privacyVersion: string;
};

export function parseLegalMetadata(value: unknown): LegalMetadata {
  return metadataSchema.parse(value);
}
export async function loadLegalMetadata(signal: AbortSignal) {
  return parseLegalMetadata(
    await publicRequest<unknown>("/legal/current", false, { signal }),
  );
}
export function matchesLegalContent(
  metadata: LegalMetadata,
  identity: LegalContentIdentity = legalContentIdentity,
): boolean {
  return (
    !metadata.acceptanceRequired ||
    (["terms", "privacy"] as const).every((kind) => {
      const current = metadata[kind];
      const local = identity[kind];
      return (
        local.status === "PUBLISHED" &&
        current.kind === local.kind &&
        current.version === local.version &&
        current.contentDigest === local.contentDigest &&
        current.path === local.path
      );
    })
  );
}
const recoveryCodes = new Set([
  "LEGAL_ACCEPTANCE_REQUIRED",
  "LEGAL_ACCEPTANCE_NOT_CONFIRMED",
  "LEGAL_ACCEPTANCE_INVALID",
  "LEGAL_VERSION_STALE",
  "LEGAL_VERSION_UNKNOWN",
  "LEGAL_DOCUMENTS_UNPUBLISHED",
  "LEGAL_REGISTRY_MISMATCH",
]);
export function legalRegistrationRecovery(error: unknown) {
  if (!(error instanceof ApiError)) return null;
  const code = error.details.find(
    (detail) =>
      detail.field === "legalAcceptance" &&
      detail.code &&
      recoveryCodes.has(detail.code),
  )?.code;
  if (!code) return null;
  const changed = [
    "LEGAL_VERSION_STALE",
    "LEGAL_VERSION_UNKNOWN",
    "LEGAL_DOCUMENTS_UNPUBLISHED",
  ].includes(code);
  return {
    changed,
    message: changed
      ? ""
      : code === "LEGAL_REGISTRY_MISMATCH"
        ? "Юридичні документи тимчасово недоступні. Спробуйте ще раз."
        : "Підтвердіть ознайомлення з актуальними документами та спробуйте ще раз.",
  };
}
