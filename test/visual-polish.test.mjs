import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "./helpers/load-frontend.mjs";
const { numericInput } = await load("src/shared/lib/numeric-input.ts");
const { navigationActive } = await load(
  "src/widgets/header/navigation-active.ts",
);
const { BreederVideoPlayer } = await load(
  "src/features/breeder/public-profile/breeder-video-player.tsx",
);
test("numeric entry retains digits and existing cents without exponent or signs", () => {
  for (const [input, decimal, expected] of [
    ["a12b3", false, "123"],
    ["1e-2", false, "12"],
    ["1250.75", true, "1250.75"],
    ["1250,75", true, "1250,75"],
    ["12.3.456", true, "12.34"],
    ["", true, ""],
    ["25 грн", true, "25"],
  ])
    assert.equal(numericInput(input, decimal), expected);
});
test("active navigation uses path segments and includes account profile children", () => {
  for (const [path, href, active] of [
    ["/listings/abc", "/listings", true],
    ["/my-listings", "/listings", false],
    ["/mating/new", "/mating", true],
    ["/profile", "/account", true],
    ["/pets/abc/care", "/pets", true],
    ["/listings-other", "/listings", false],
  ])
    assert.equal(navigationActive(path, href), active);
});
test("breeder video immediately available, lazy and never autoplay", () => {
  const html = renderToStaticMarkup(
    React.createElement(BreederVideoPlayer, {
      video: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      index: 0,
    }),
  );
  assert.ok(html.includes("<iframe"));
  assert.ok(html.includes('loading="lazy"'));
  assert.ok(!html.includes("Переглянути відео"));
  assert.ok(html.includes("autoplay=0"));
  assert.ok(html.includes("Відео розплідника 1"));
});
