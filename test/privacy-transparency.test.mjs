import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { PublicVideoPlayer } = await load(
  "src/shared/ui/public-video-player.tsx",
);
const { BreederVideoPlayer } = await load(
  "src/features/breeder/public-profile/breeder-video-player.tsx",
);
const { videoEmbedUrl, normalizedVideoUrl } = await load(
  "src/shared/lib/video-url.ts",
);
const { PrivacyContact, privacyContactEmail } = await load(
  "src/features/legal/privacy-contact.tsx",
);
const { privacyDocument } = await load("src/features/legal/content/privacy.ts");
const { termsDocument } = await load("src/features/legal/content/terms.ts");
const { LegalDocumentPage } = await load(
  "src/features/legal/legal-document-page.tsx",
);
const html = (Component, props) =>
  renderToStaticMarkup(React.createElement(Component, props));

for (const [provider, url] of [
  ["YouTube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
  ["Vimeo", "https://vimeo.com/123456789"],
]) {
  for (const [location, Component] of [
    ["Pet/shared", PublicVideoPlayer],
    ["breeder", BreederVideoPlayer],
  ])
    test(`${location} ${provider} renders local disclosure without any provider media resource`, () => {
      const output = html(Component, {
        video: { url },
        index: 0,
        label: "Відео тварини",
      });
      assert.doesNotMatch(
        output,
        /<iframe|<img|<script|<link\b|\bsrc=|poster=|srcset=/i,
      );
      assert.match(output, /<svg/);
      assert.match(output, /Завантажити відео/);
      assert.match(output, /Сторонній сервіс може отримати технічні дані/);
      assert.ok(output.includes(provider));
      assert.match(output, /aria-expanded="false"/);
      assert.match(output, /rel="noopener noreferrer"/);
      assert.ok(output.includes(`href="${normalizedVideoUrl(url)}"`));
    });
}
test("all invalid/foreign/private video URLs retain existing rejection; embeds remain privacy-enhanced and never autoplay", () => {
  for (const url of [
    "javascript:alert(1)",
    "https://youtube.com.evil.invalid/watch?v=dQw4w9WgXcQ",
    "http://vimeo.com/123",
    "https://u:p@vimeo.com/123",
    "https://vimeo.com/123?h=secret",
    "https://player.vimeo.com/video/123",
    "https://youtu.be/bad",
    "https://www.youtube.com:444/watch?v=dQw4w9WgXcQ",
  ]) {
    assert.equal(videoEmbedUrl(url), null);
    assert.equal(
      html(PublicVideoPlayer, { video: { url }, label: "Відео", index: 0 }),
      "",
    );
  }
  assert.equal(
    videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=0&controls=1",
  );
  assert.equal(
    videoEmbedUrl("https://vimeo.com/123"),
    "https://player.vimeo.com/video/123?autoplay=0&dnt=1",
  );
});
test("multiple placeholders have unique controls and no immediate or persisted opt-in path", async () => {
  const output = renderToStaticMarkup(
    React.createElement(
      "ul",
      null,
      [0, 1].map((index) =>
        React.createElement(PublicVideoPlayer, {
          key: index,
          video: { url: "https://vimeo.com/123" },
          label: "Відео",
          index,
        }),
      ),
    ),
  );
  const ids = [...output.matchAll(/aria-controls="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(new Set(ids).size, 2);
  const source = await readFile(
    "src/shared/ui/public-video-player.tsx",
    "utf8",
  );
  assert.match(source, /key=\{embed\}/);
  assert.doesNotMatch(
    source,
    /immediate|localStorage|sessionStorage|document\.cookie|fetch\(|preconnect|\boEmbed\b/,
  );
  assert.match(source, /strict-origin-when-cross-origin/);
});
test("missing/unverified/invalid/placeholder contacts fail safely without a mailto or developer fallback", () => {
  for (const config of [
    undefined,
    null,
    {},
    { status: "UNAVAILABLE", email: null },
    { status: "UNAVAILABLE", email: "private@operator-fixture.ua" },
    { status: "UNVERIFIED", email: "privacy@operator-fixture.ua" },
    { status: "VERIFIED", email: "bad" },
    { status: "VERIFIED", email: "https://evil.invalid" },
    { status: "VERIFIED", email: "privacy@example.com" },
    { status: "VERIFIED", email: "privacy@operator.invalid" },
    { status: "VERIFIED", email: "privacy@operator.example" },
    {
      status: "VERIFIED",
      email: "privacy@operator-fixture.ua",
      fallback: true,
    },
  ]) {
    assert.equal(privacyContactEmail(config), null);
    const output = html(PrivacyContact, { config });
    assert.doesNotMatch(output, /mailto:|private@|privacy@/);
    assert.match(output, /Контакт для звернень ще не налаштовано/);
  }
});
test("synthetic explicitly verified contact renders exact safe address; it is not a request submission confirmation", () => {
  const config = { status: "VERIFIED", email: "privacy@operator-fixture.ua" }; // Synthetic fixture only, not operator contact.
  assert.equal(privacyContactEmail(config), config.email);
  const output = html(PrivacyContact, { config });
  assert.match(output, /mailto:privacy%40operator-fixture.ua/);
  assert.ok(output.includes(config.email));
  assert.match(output, /не означає автоматичне виконання/);
  assert.doesNotMatch(output, /<form|успішно надіслано|запит прийнято/);
});
test("current legal contact is unavailable, draft/noindex stays; cookies, controls and request limits remain truthful", async () => {
  assert.equal(privacyDocument.status, "development-draft");
  assert.equal(termsDocument.status, "development-draft");
  assert.deepEqual(privacyDocument.privacyContact, {
    status: "UNAVAILABLE",
    email: null,
  });
  const output = html(LegalDocumentPage, { document: privacyDocument });
  assert.doesNotMatch(output, /mailto:|<form|PHASE_16E|DRAFT_REGISTRY|BLOCKER/);
  for (const text of [
    "pet_refresh",
    "pet_csrf",
    "__Secure-pet_refresh",
    "__Host-pet_csrf",
    "14 днів",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    "IndexedDB",
    "CacheStorage",
    "Service Worker",
    "youtube-nocookie",
    "dnt=1",
    "автоматичного видалення акаунта",
    "експорту всіх",
    "Контакт для звернень ще не налаштовано",
  ])
    assert.ok(output.includes(text), text);
  for (const route of ["privacy", "terms"])
    assert.equal(
      (await load(`src/app/${route}/page.tsx`)).metadata.robots.index,
      false,
    );
});
test("contact configuration is inside versioned content and the existing digest/Markdown gate, not an environment bypass", async () => {
  const source = await readFile(
    "src/features/legal/privacy-contact.tsx",
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /process\.env|NEXT_PUBLIC_|fetch\(|localStorage|sessionStorage/,
  );
  execFileSync(
    process.execPath,
    ["scripts/sync-legal-integrity.mjs", "--check"],
    { stdio: "pipe" },
  );
  execFileSync(process.execPath, ["scripts/sync-legal-drafts.mjs", "--check"], {
    stdio: "pipe",
  });
});
