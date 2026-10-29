import { readFile } from "node:fs/promises";
import ts from "typescript";
import { canonicalLegalJson, legalContentDigest } from "./legal-content.mjs";

export const frontendRoot = new URL("../../", import.meta.url);
export async function loadLegalModule(url) {
  const output = ts.transpileModule(await readFile(url, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
}
export async function readLegalDocuments(root = frontendRoot) {
  const documents = {};
  for (const slug of ["terms", "privacy"]) {
    const source = await loadLegalModule(
      new URL(`src/features/legal/content/${slug}.ts`, root),
    );
    documents[slug] = source[`${slug}Document`];
    if (!["development-draft", "published"].includes(documents[slug]?.status))
      throw new Error(`Invalid legal document status: ${slug}`);
  }
  return documents;
}
export function legalIdentity(documents, digest = legalContentDigest) {
  return Object.fromEntries(
    Object.entries(documents).map(([slug, document]) => {
      const { version, ...content } = document;
      const kind = slug === "terms" ? "TERMS" : "PRIVACY";
      const path = `/${slug}`;
      return [
        slug,
        {
          kind,
          version,
          status:
            document.status === "development-draft" ? "DRAFT" : "PUBLISHED",
          path,
          contentDigest: digest({ kind, version, path, content }),
        },
      ];
    }),
  );
}
export async function checkFrontendIntegrity(root = frontendRoot) {
  const documents = await readLegalDocuments(root),
    identity = legalIdentity(documents);
  const { legalContentIdentity } = await loadLegalModule(
    new URL("src/features/legal/content/content-integrity.ts", root),
  );
  if (canonicalLegalJson(legalContentIdentity) !== canonicalLegalJson(identity))
    throw new Error("Frontend legal content identity drift");
  return { documents, identity };
}
