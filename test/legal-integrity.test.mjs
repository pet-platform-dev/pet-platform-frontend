import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  canonicalLegalJson,
  legalContentDigest,
} from "../scripts/lib/legal-content.mjs";
import {
  checkFrontendIntegrity,
  frontendRoot,
} from "../scripts/lib/legal-integrity.mjs";
import { checkCrossRepoIntegrity } from "../scripts/lib/legal-cross-repo.mjs";

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "lapa-legal-integrity-"));
  const frontend = pathToFileURL(join(root, "frontend") + sep),
    backend = pathToFileURL(join(root, "backend") + sep);
  await mkdir(new URL("src/features/legal/content/", frontend), {
    recursive: true,
  });
  await mkdir(new URL("src/legal/", backend), { recursive: true });
  for (const file of ["terms.ts", "privacy.ts", "content-integrity.ts"])
    await writeFile(
      new URL("src/features/legal/content/" + file, frontend),
      await readFile(
        new URL("src/features/legal/content/" + file, frontendRoot),
      ),
    );
  // Synthetic backend registry built only from the frontend fixture, no sibling required.
  const { documents, identity } = await checkFrontendIntegrity(frontend);
  const registry = {
    activation: "DRAFT_ONLY",
    current: {
      termsVersion: identity.terms.version,
      privacyVersion: identity.privacy.version,
    },
    documents: Object.entries(identity).map(([slug, entry]) => {
      const content = { ...documents[slug] };
      delete content.version;
      return { ...entry, effectiveAt: null, content };
    }),
  };
  await writeFile(
    new URL("src/legal/legal-artifacts.ts", backend),
    "export const legalArtifacts = " + JSON.stringify(registry) + ";",
  );
  await writeFile(
    new URL("src/legal/legal-content.ts", backend),
    await readFile(
      new URL("../scripts/lib/legal-content.mjs", import.meta.url),
    ),
  );
  try {
    await run({ frontend, backend, registry });
  } finally {
    if (
      !resolve(root).startsWith(resolve(tmpdir()) + sep) ||
      !root.includes("lapa-legal-integrity-")
    )
      throw Error("Unsafe fixture cleanup");
    await rm(root, { recursive: true, force: true });
  }
}
test("canonical JSON preserves SHA-256 contract normalization and ordered arrays", () => {
  assert.equal(
    canonicalLegalJson({ z: "e\u0301\r\n", a: [2, 1] }),
    '{"a":[2,1],"z":"é\\n"}',
  );
  assert.notEqual(
    legalContentDigest({ content: [1, 2] }),
    legalContentDigest({ content: [2, 1] }),
  );
  assert.throws(() => canonicalLegalJson(undefined));
});
test("frontend local integrity needs no backend or docs and preserves existing draft identities", async () => {
  const { identity } = await checkFrontendIntegrity();
  assert.equal(
    identity.terms.contentDigest,
    "fca1f5897f4f0207f3fcc7bf9ce6197d1d82e2f5fbf26399d651d881432676ee",
  );
  assert.equal(
    identity.privacy.contentDigest,
    "772246224867dae7e820d2adfecca0246c8877be666f2ca722e680038253a7b7",
  );
  assert.equal(identity.terms.status, "DRAFT");
  assert.equal(identity.privacy.version, "16g-draft.1");
});
test("missing or changed frontend legal files fail closed", () =>
  fixture(async ({ frontend }) => {
    const terms = new URL("src/features/legal/content/terms.ts", frontend);
    const original = await readFile(terms, "utf8");
    await writeFile(
      terms,
      original.replace("Умови користування", "Змінений документ"),
    );
    await assert.rejects(checkFrontendIntegrity(frontend), /identity drift/);
    await rm(terms);
    await assert.rejects(checkFrontendIntegrity(frontend), /ENOENT/);
  }));
test("explicit cross-repo check accepts parity and rejects registry or algorithm mismatches", () =>
  fixture(async ({ frontend, backend, registry }) => {
    assert.equal(
      (await checkCrossRepoIntegrity(frontend, backend)).activation,
      "DRAFT_ONLY",
    );
    const command = [
      "scripts/check-legal-cross-repo.mjs",
      "--backend-root",
      fileURLToPath(backend),
    ];
    assert.match(
      execFileSync(process.execPath, command, {
        encoding: "utf8",
        stdio: "pipe",
      }),
      /activation=DRAFT_ONLY/,
    );
    const target = new URL("src/legal/legal-artifacts.ts", backend);
    registry.documents[0].contentDigest = "0".repeat(64);
    await writeFile(
      target,
      "export const legalArtifacts = " + JSON.stringify(registry),
    );
    await assert.rejects(
      checkCrossRepoIntegrity(frontend, backend),
      /registry mismatch/,
    );
    assert.throws(
      () =>
        execFileSync(process.execPath, command, {
          encoding: "utf8",
          stdio: "pipe",
        }),
      (error) =>
        error.status !== 0 && error.stderr.includes("registry mismatch"),
    );
    registry.documents[0].contentDigest =
      "fca1f5897f4f0207f3fcc7bf9ce6197d1d82e2f5fbf26399d651d881432676ee";
    await writeFile(
      target,
      "export const legalArtifacts = " + JSON.stringify(registry),
    );
    registry.activation = "REQUIRED";
    await writeFile(
      target,
      "export const legalArtifacts = " + JSON.stringify(registry),
    );
    await assert.rejects(
      checkCrossRepoIntegrity(frontend, backend),
      /registry mismatch/,
    );
    registry.activation = "DRAFT_ONLY";
    await writeFile(
      target,
      "export const legalArtifacts = " + JSON.stringify(registry),
    );
    const algorithm = new URL("src/legal/legal-content.ts", backend),
      source = await readFile(algorithm, "utf8");
    await writeFile(
      algorithm,
      source.replaceAll("lapa-legal-v1", "lapa-legal-mismatch"),
    );
    await assert.rejects(
      checkCrossRepoIntegrity(frontend, backend),
      /digest contract mismatch/,
    );
    await rm(algorithm);
    await assert.rejects(checkCrossRepoIntegrity(frontend, backend), /ENOENT/);
  }));
