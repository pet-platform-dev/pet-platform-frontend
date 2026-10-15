import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const css = await readFile("src/app/globals.css", "utf8");
test("long profile identities and Pet Care context can wrap without widening the page", async () => {
  assert.match(
    css,
    /\.profile-editor\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/,
  );
  assert.match(css, /\.profile-editor \.auth-form\s*\{[^}]*min-width:\s*0;/);
  const care = await readFile("src/features/pet-care/pet-care.css", "utf8");
  assert.match(
    care,
    /\.pet-care-page\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/,
  );
});
test("shared focus rings use the existing high-contrast accent on light and muted surfaces", async () => {
  assert.match(css, /--focus-ring:\s*var\(--accent\)/);
  const color = css.match(/--accent:\s*#([a-f\d]{6})/i)[1];
  const luminance = (hex) => {
    const c = hex
      .match(/../g)
      .map((x) => parseInt(x, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  for (const surface of ["fffdf9", "faf7f2", "e8eddf"]) {
    const a = luminance(color),
      b = luminance(surface);
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 3);
  }
  for (const path of [
    "app/globals.css",
    "shared/ui/select-dropdown.css",
    "shared/ui/interaction.css",
    "features/auth/account-type.css",
    "features/breeder/animals/breeder-animals.css",
  ]) {
    const sheet = await readFile("src/" + path, "utf8");
    assert.match(sheet, /outline:[^;]*var\(--focus-ring\)/);
    assert.doesNotMatch(sheet, /outline:[^;]*#(?:9bab78|8baf75)/);
  }
});
