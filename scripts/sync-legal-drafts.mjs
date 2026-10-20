import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// The UI content is the review source for 16B. These Markdown copies are generated
// review artifacts, not separate legal versions. No acceptance/effective date.
const check = process.argv.slice(2);
if (check.length !== 1 || !["--check", "--write"].includes(check[0])) {
  throw new Error("Use --check or --write");
}
const prose = (text) => text.replaceAll("_", "\\_");
let stale = false;
for (const [name, file, symbol] of [
  ["privacy", "privacy-policy-draft.md", "privacyDocument"],
  ["terms", "terms-of-use-draft.md", "termsDocument"],
]) {
  const source = new URL(
    `../src/features/legal/content/${name}.ts`,
    import.meta.url,
  );
  const code = ts.transpileModule(await readFile(source, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const document = (
    await import(
      `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
    )
  )[symbol];
  const target = new URL(
    `../../pet-platform-docs/legal/${file}`,
    import.meta.url,
  );
  const sections = document.sections.map(
    (section, index) =>
      `## ${index + 1}. ${section.title}\n\n` +
      section.paragraphs.map(prose).join("\n\n") +
      (section.bullets
        ? "\n\n" + section.bullets.map((item) => `- ${prose(item)}`).join("\n")
        : ""),
  );
  const text =
    `# ${document.title}\n\n` +
    `DEVELOPMENT DRAFT — NOT APPROVED FOR PRODUCTION. Generated review copy; do not edit independently.\n\n` +
    `Source: \`pet-platform-frontend/src/features/legal/content/${name}.ts\`. This is content synchronization, not a canonical legal version or effective date. See [publication checklist](legal-publication-checklist.md) and [Phase16B validation](../roadmap/phase-16b-validation.md).\n\n` +
    prose(document.description) +
    "\n\n" +
    sections.join("\n\n") +
    "\n";
  if (check[0] === "--write") {
    await writeFile(target, text);
    console.log(`Updated ${file}`);
  } else if ((await readFile(target, "utf8").catch(() => "")) !== text) {
    stale = true;
    console.error(`Draft is out of sync: ${fileURLToPath(target)}`);
  } else console.log(`Synchronized: ${file}`);
}
if (stale) process.exitCode = 1;
