import { writeFile } from "node:fs/promises";
import { canonicalLegalJson } from "./lib/legal-content.mjs";
import {
  loadLegalModule as load,
  readLegalDocuments,
  legalIdentity,
} from "./lib/legal-integrity.mjs";

const args = process.argv.slice(2);
if (args.length !== 1 || !["--write", "--check"].includes(args[0]))
  throw new Error("Use --write or --check");
// Verify only repository-local content. Backend parity is an explicit release check.
const identity = legalIdentity(await readLegalDocuments());
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
