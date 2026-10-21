import { readFile, writeFile } from "node:fs/promises";
import ts from "typescript";

const args = process.argv.slice(2);
if (args.length !== 1 || !["--write", "--check"].includes(args[0]))
  throw new Error("Use --write or --check");
async function load(url) {
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
// Reuse the authoritative 16C algorithm at build time. Never ship backend code,
// document prose or a second hashing implementation in registration's bundle.
const { legalContentDigest, canonicalLegalJson } = await load(
  new URL(
    "../../pet-platform-backend/src/legal/legal-content.ts",
    import.meta.url,
  ),
);
const identity = {};
for (const [kind, slug, symbol] of [
  ["TERMS", "terms", "termsDocument"],
  ["PRIVACY", "privacy", "privacyDocument"],
]) {
  const { [symbol]: document } = await load(
    new URL(`../src/features/legal/content/${slug}.ts`, import.meta.url),
  );
  const { version, ...content } = document;
  identity[slug] = {
    kind,
    version,
    status: document.status === "development-draft" ? "DRAFT" : "PUBLISHED",
    path: `/${slug}`,
    contentDigest: legalContentDigest({
      kind,
      version,
      path: `/${slug}`,
      content,
    }),
  };
}
const target = new URL(
  "../src/features/legal/content/content-integrity.ts",
  import.meta.url,
);
if (args[0] === "--write") {
  await writeFile(
    target,
    `// Generated from actual frontend content with the Phase16C backend digest algorithm.\n// Run scripts/sync-legal-integrity.mjs --write after a reviewed revision change.\nexport const legalContentIdentity = ${JSON.stringify(identity, null, 2)} as const;\n`,
  );
} else {
  const { legalContentIdentity } = await load(target);
  if (canonicalLegalJson(legalContentIdentity) !== canonicalLegalJson(identity))
    throw new Error("Frontend legal content identity drift");
}
console.log(
  "Frontend legal content identity verified; legal approval remains separate.",
);
