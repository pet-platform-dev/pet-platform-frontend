import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const modules = new Map();
const dataModule = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const navigation = dataModule(
  "export function useRouter() { return { push() {}, replace() {} }; } export function useSearchParams() { return null; } export function usePathname() { return '/listings'; }",
);
const link = dataModule(
  `import React from ${JSON.stringify(pathToFileURL(require.resolve("react")).href)}; export default function Link({children,href,scroll,prefetch,onNavigate,...props}) { return React.createElement('a',{...props,href},children); }`,
);
const image = dataModule(
  `import React from ${JSON.stringify(pathToFileURL(require.resolve("react")).href)}; export default function Image({unoptimized,priority,...props}) { return React.createElement('img',props); }`,
);
async function moduleUrl(relative) {
  const full = resolve(relative);
  if (modules.has(full)) return modules.get(full);
  let output = ts.transpileModule(await readFile(full, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  for (const match of [...output.matchAll(/from\s+["']([^"']+)["']/g)]) {
    const dependency = match[1];
    let url;
    if (dependency === "next/navigation") url = navigation;
    else if (dependency === "next/link") url = link;
    else if (dependency === "next/image") url = image;
    else if (dependency.startsWith("@/") || dependency.startsWith(".")) {
      const local = dependency.startsWith("@/")
        ? resolve("src", dependency.slice(2))
        : resolve(dirname(full), dependency);
      let source;
      for (const candidate of [local, `${local}.ts`, `${local}.tsx`]) {
        try {
          await readFile(candidate);
          source = candidate;
          break;
        } catch {}
      }
      assert.ok(source, `Missing test source ${dependency}`);
      url = await moduleUrl(source);
    } else if (dependency === "@tanstack/react-query")
      url = pathToFileURL(
        resolve("node_modules/@tanstack/react-query/build/modern/index.js"),
      ).href;
    else url = pathToFileURL(require.resolve(dependency)).href;
    output = output.replace(match[0], `from ${JSON.stringify(url)}`);
  }
  const url = dataModule(output);
  modules.set(full, url);
  return url;
}
export async function load(path) {
  return import(await moduleUrl(path));
}
