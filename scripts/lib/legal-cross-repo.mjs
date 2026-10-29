import { canonicalLegalJson } from "./legal-content.mjs";
import {
  checkFrontendIntegrity,
  legalIdentity,
  loadLegalModule,
} from "./legal-integrity.mjs";

export async function checkCrossRepoIntegrity(frontendRoot, backendRoot) {
  const { documents, identity } = await checkFrontendIntegrity(frontendRoot);
  const backend = await loadLegalModule(
    new URL("src/legal/legal-content.ts", backendRoot),
  );
  const { legalArtifacts: registry } = await loadLegalModule(
    new URL("src/legal/legal-artifacts.ts", backendRoot),
  );
  // Exercise normalization, not just today's already-normalized document prose.
  for (const value of [
    null,
    true,
    17,
    "e\u0301\r\nline\r",
    { z: [2, 1], a: "ї" },
    { nested: { z: false, a: null } },
  ]) {
    if (canonicalLegalJson(value) !== backend.canonicalLegalJson(value))
      throw new Error(
        "Backend/frontend legal canonical JSON contract mismatch",
      );
  }
  if (
    canonicalLegalJson(identity) !==
    backend.canonicalLegalJson(
      legalIdentity(documents, backend.legalContentDigest),
    )
  )
    throw new Error("Backend/frontend legal digest contract mismatch");
  for (const [slug, entry] of Object.entries(identity)) {
    const snapshot = registry.documents.find(
      (item) => item.kind === entry.kind && item.version === entry.version,
    );
    const content = { ...documents[slug] };
    delete content.version;
    if (
      registry.current[`${slug}Version`] !== entry.version ||
      !snapshot ||
      snapshot.status !== entry.status ||
      (entry.status === "DRAFT" &&
        (registry.activation !== "DRAFT_ONLY" ||
          snapshot.effectiveAt !== null)) ||
      snapshot.path !== entry.path ||
      snapshot.contentDigest !== entry.contentDigest ||
      backend.canonicalLegalJson(snapshot.content) !==
        canonicalLegalJson(content) ||
      backend.legalContentDigest({
        kind: entry.kind,
        version: entry.version,
        path: entry.path,
        content: snapshot.content,
      }) !== entry.contentDigest
    )
      throw new Error(`Backend legal registry mismatch: ${slug}`);
  }
  return { activation: registry.activation, identity };
}
