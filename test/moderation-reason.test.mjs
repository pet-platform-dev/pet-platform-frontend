import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { PublicationState } = await load("src/shared/ui/publication-state.tsx");
test("owner rejected/hidden reason is readable plain text and never interpreted as markup", () => {
  for (const moderationStatus of ["REJECTED", "HIDDEN"]) {
    const html = renderToStaticMarkup(
      React.createElement(PublicationState, {
        row: {
          status: "DRAFT",
          moderationStatus,
          moderationReason: "Причина: <script>unsafe</script>",
        },
      }),
    );
    assert.match(html, /Причина модерації/);
    assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>/);
  }
});
test("stale reason is absent in pending and approved presentation", () => {
  for (const moderationStatus of ["PENDING", "APPROVED"]) {
    const html = renderToStaticMarkup(
      React.createElement(PublicationState, {
        row: {
          status: "ACTIVE",
          moderationStatus,
          moderationReason: "OLD REASON",
        },
      }),
    );
    assert.doesNotMatch(html, /OLD REASON|Причина модерації/);
  }
});
