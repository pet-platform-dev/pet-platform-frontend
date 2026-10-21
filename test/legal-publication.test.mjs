import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { privacyDocument } = await load("src/features/legal/content/privacy.ts");
const { termsDocument } = await load("src/features/legal/content/terms.ts");
const { LegalDocumentPage } = await load(
  "src/features/legal/legal-document-page.tsx",
);
const { legalPageMetadata } = await load(
  "src/features/legal/legal-page-metadata.ts",
);

test("legal presentation has no development notice; only explicit publication permits indexing", () => {
  for (const source of [privacyDocument, termsDocument]) {
    const draft = renderToStaticMarkup(
      React.createElement(LegalDocumentPage, {
        document: source,
        contact: privacyDocument.privacyContact,
      }),
    );
    assert.doesNotMatch(
      draft,
      /Чернетка для ознайомлення|legal-draft-notice|Статус документа|Публікацію документа ще не активовано/,
    );
    assert.equal(legalPageMetadata(source).robots.index, false);
    const published = {
      ...source,
      status: "published",
      version: "synthetic-only-published",
    };
    const output = renderToStaticMarkup(
      React.createElement(LegalDocumentPage, {
        document: published,
        contact: privacyDocument.privacyContact,
      }),
    );
    assert.doesNotMatch(
      output,
      /Чернетка для ознайомлення|development draft|тестова версія|pending legal approval|остаточну редакцію не затверджено/i,
    );
    assert.equal(legalPageMetadata(published).robots.index, true);
    assert.match(output, /mailto:lapaasupport%40gmail.com/);
    assert.match(output, /Cloudinary/);
    assert.match(output, /YouTube/);
  }
});
test("both actual routes share the validated canonical contact and remain draft/noindex until activation", async () => {
  for (const slug of ["privacy", "terms"]) {
    const page = await load(`src/app/${slug}/page.tsx`);
    const output = renderToStaticMarkup(React.createElement(page.default));
    assert.equal(
      (output.match(/href="mailto:lapaasupport%40gmail.com"/g) || []).length,
      1,
    );
    assert.doesNotMatch(
      output,
      /Чернетка для ознайомлення|legal-draft-notice|Статус документа|Публікацію документа ще не активовано/,
    );
    assert.equal(page.metadata.robots.index, false);
  }
});
