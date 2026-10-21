import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { execFileSync } from "node:child_process";
import { load } from "./helpers/load-frontend.mjs";

const privacy = await load("src/app/privacy/page.tsx");
const terms = await load("src/app/terms/page.tsx");
const { privacyDocument } = await load("src/features/legal/content/privacy.ts");
const { termsDocument } = await load("src/features/legal/content/terms.ts");
const { SiteFooter } = await load("src/widgets/footer/site-footer.tsx");
const html = (Component) =>
  renderToStaticMarkup(React.createElement(Component));

for (const [route, page, document, count, title] of [
  ["privacy", privacy, privacyDocument, 18, "Політика конфіденційності"],
  ["terms", terms, termsDocument, 19, "Умови користування"],
]) {
  test(`/${route} renders for a guest without an auth provider`, () => {
    const output = html(page.default);
    assert.match(output, /<main/);
    assert.equal((output.match(/<h1[ >]/g) ?? []).length, 1);
    assert.ok(output.includes(title));
    assert.ok(page.metadata.title.includes(title));
    assert.equal(page.metadata.robots.index, false);
    assert.equal(document.status, "development-draft");
    assert.match(output, /Чернетка/);
    assert.doesNotMatch(
      output,
      /mailto:|privacy@|support@|діє з|GDPR compliant/i,
    );
  });
  test(`/${route} has complete sections, unique accessible anchors and cross-link`, () => {
    const output = html(page.default);
    assert.equal(document.sections.length, count);
    const ids = document.sections.map((section) => section.id);
    assert.equal(new Set(ids).size, count);
    for (const section of document.sections) {
      assert.match(section.id, /^[a-z][a-z-]+$/);
      assert.ok(output.includes(`id="${section.id}"`));
      assert.ok(output.includes(`href="#${section.id}"`));
      assert.ok(output.includes(section.title));
      assert.ok(section.paragraphs.length);
    }
    assert.ok(
      output.includes(`href="/${route === "privacy" ? "terms" : "privacy"}"`),
    );
  });
}

test("footer exposes both stable legal routes without an auth provider", () => {
  const output = html(SiteFooter);
  assert.match(output, /href="\/privacy"/);
  assert.match(output, /href="\/terms"/);
  assert.match(output, /Політика конфіденційності/);
  assert.match(output, /Умови користування/);
});

test("an authenticated cache does not alter legal content or expose account fields", () => {
  const client = new QueryClient();
  client.setQueryData(["current-user"], {
    id: "fixture",
    email: "private@example.invalid",
  });
  try {
    for (const page of [privacy.default, terms.default]) {
      const output = renderToStaticMarkup(
        React.createElement(
          QueryClientProvider,
          { client },
          React.createElement(page),
        ),
      );
      assert.ok(output.includes("Чернетка для ознайомлення"));
      assert.ok(!output.includes("private@example.invalid"));
    }
  } finally {
    client.clear();
  }
});

test("Markdown review copies stay synchronized with the UI source", () => {
  execFileSync(process.execPath, ["scripts/sync-legal-drafts.mjs", "--check"], {
    stdio: "pipe",
  });
});

test("privacy copy keeps the audited cookie, identity, messaging, care and media boundaries", () => {
  const output = html(privacy.default);
  for (const value of [
    "pet_refresh",
    "__Secure-pet_refresh",
    "pet_csrf",
    "__Host-pet_csrf",
    "HttpOnly",
    "SameSite=Lax",
    "14 днів",
    "localStorage",
    "sessionStorage",
    "Cloudinary",
    "YouTube",
    "Vimeo",
    "наскрізне шифрування",
    "повне ім’я",
    "Pet Care",
    "повторних спроб",
    "ще не визначено",
  ]) {
    assert.ok(
      output.toLocaleLowerCase("uk").includes(value.toLocaleLowerCase("uk")),
      value,
    );
  }
  assert.match(output, /Лише натискання «Завантажити відео»/);
  assert.doesNotMatch(output, /розплідника може завантажуватися до натискання/);
  assert.match(output, /автоматичного видалення акаунта/);
});

test("legal source remains guest-accessible and footer is mounted in the shared layout", async () => {
  const layout = await readFile("src/app/layout.tsx", "utf8");
  assert.match(layout, /<SiteFooter\s*\/>/);
  for (const path of [
    "src/app/privacy/page.tsx",
    "src/app/terms/page.tsx",
    "src/features/legal/legal-document-page.tsx",
  ]) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(
      source,
      /RequireSession|authenticatedRequest|redirect\(|useSession/,
    );
  }
});
