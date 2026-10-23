import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// Actual React/StrictMode DOM regression with intercepted documents, not a live
// Next.js/browser integration claim. No network server, real account or mail.
const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack");
const output = resolve("test-results/phase17b-lifetime");
await mkdir(output, { recursive: true });
await new Promise((yes, no) => {
  const compiler = webpack({
    mode: "development",
    target: "web",
    devtool: false,
    entry: resolve("test/helpers/verification-react-fixture.tsx"),
    output: { path: output, filename: "fixture.js" },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      alias: {
        "@": resolve("src"),
        "next/link$": resolve("test/helpers/verification-browser-link.tsx"),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: resolve("test/helpers/verification-typescript-loader.cjs"),
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(
          "http://localhost:4000/api/v1",
        ),
      }),
    ],
  });
  compiler.run((error, stats) =>
    compiler.close((closeError) => {
      if (error || closeError) no(error ?? closeError);
      else if (stats.hasErrors())
        no(new Error(stats.toString({ all: false, errors: true })));
      else yes();
    }),
  );
});
const bundle = await readFile(resolve(output, "fixture.js"), "utf8");
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_URL ?? "playwright"
);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "msedge",
});
const token = "a".repeat(43),
  results = [];
async function fixture(query, mode = "success") {
  const context = await browser.newContext();
  // Entire document is intercepted before a network connection is attempted.
  await context.route("**/*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="uk"><body><main id="root"></main></body></html>',
    }),
  );
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydration failed|hydrated but|same key/i.test(message.text()))
      errors.push(message.text());
  });
  await page.goto(`http://localhost:3017/verify-email${query}`);
  await page.evaluate((mode) => {
    window.fixtureRequests = [];
    window.fetch = async (url, init) => {
      if (String(url).endsWith("/auth/csrf"))
        return Response.json({ data: { csrfToken: "synthetic-csrf" } });
      if (String(url).endsWith("/auth/refresh")) {
        await new Promise((resolve) =>
          window.addEventListener("fixture-restore", resolve, { once: true }),
        );
        return Response.json({
          data: {
            user: { id: "synthetic-owner-a" },
            accessToken: "synthetic-access",
            expiresIn: 900,
          },
        });
      }
      if (String(url).endsWith("/users/me") || String(url).endsWith("/auth/me"))
        return Response.json({
          data: { id: "synthetic-owner-a", verificationStatus: "VERIFIED" },
        });
      if (String(url).endsWith("/email-verification/confirm")) {
        window.fixtureRequests.push(JSON.parse(init.body));
        await new Promise((resolve) => setTimeout(resolve, 80));
        if (mode === "invalid") return Response.json({}, { status: 400 });
        if (mode === "temporary" && window.fixtureRequests.length === 1)
          return Response.json({}, { status: 503 });
        return Response.json({ data: { verificationStatus: "VERIFIED" } });
      }
      throw Error("Unexpected fixture request");
    };
  }, mode);
  await page.addScriptTag({ content: bundle });
  return { page, context, errors };
}
const confirm = (page) =>
  page.getByRole("button", { name: "Підтвердити пошту", exact: true });
try {
  const f = await fixture(`?token=${token}`);
  try {
    await confirm(f.page).waitFor();
    assert(
      Number(await f.page.locator("html").getAttribute("data-strict-setups")) >=
        1,
      "Hydration must mount the real route subtree",
    );
    assert.equal(new URL(f.page.url()).search, "");
    assert.equal(await f.page.evaluate(() => window.fixtureRequests.length), 0);
    await f.page.locator("#fixture-restore").click();
    await f.page
      .locator("#fixture-owner")
      .getByText("synthetic-owner-a", { exact: true })
      .waitFor();
    assert(
      await confirm(f.page).isVisible(),
      "restoring the actual root FavoriteProvider session after URL cleanup must not discard the verification controller",
    );
    await f.page.locator("#fixture-switch").click();
    await f.page
      .locator("#fixture-owner")
      .getByText("synthetic-owner-b", { exact: true })
      .waitFor();
    assert(
      await confirm(f.page).isVisible(),
      "switching account must not remount the route layout",
    );
    await f.page.locator("#fixture-logout").click();
    await f.page
      .locator("#fixture-owner")
      .getByText("guest", { exact: true })
      .waitFor();
    assert(await confirm(f.page).isVisible());
    await f.page.locator("#fixture-rerender").click();
    assert(await confirm(f.page).isVisible());
    await f.page.locator("#fixture-remount").click();
    assert(
      await confirm(f.page).isVisible(),
      "page replacement after URL cleanup must retain the original credential",
    );
    await confirm(f.page).evaluate((button) => {
      button.click();
      button.click();
    });
    await f.page
      .getByText("Електронну пошту підтверджено!", { exact: true })
      .waitFor();
    assert.deepEqual(await f.page.evaluate(() => window.fixtureRequests), [
      { token },
    ]);
    await f.page.locator("#fixture-remount").click();
    assert.equal(await confirm(f.page).count(), 0);
    assert.equal(
      await f.page.evaluate(() => localStorage.length + sessionStorage.length),
      0,
    );
    assert.deepEqual(f.errors, []);
    results.push(
      "StrictMode hydration: capture → URL cleanup → root session restore/switch/logout → rerender/page replacement → one explicit POST → success",
    );
    await f.page.reload();
    await f.page.addScriptTag({ content: bundle });
    await f.page.getByText(/Відкрийте посилання з листа/).waitFor();
    assert.equal(await confirm(f.page).count(), 0);
    results.push(
      "full document refresh after cleanup starts a new missing-token session",
    );
  } finally {
    await f.context.close();
  }
  const strict = await fixture(`?token=${token}&strictMount=1`);
  try {
    await confirm(strict.page).waitFor();
    await strict.page.waitForFunction(
      () => Number(document.documentElement.dataset.strictSetups) >= 2,
    );
    await strict.page.locator("#fixture-restore").click();
    await strict.page
      .locator("#fixture-owner")
      .getByText("synthetic-owner-a", { exact: true })
      .waitFor();
    assert(await confirm(strict.page).isVisible());
    assert.equal(
      await strict.page.evaluate(() => window.fixtureRequests.length),
      0,
    );
    assert.deepEqual(strict.errors, []);
    results.push(
      "development StrictMode effect replay + root session restoration retains credential without automatic POST",
    );
  } finally {
    await strict.context.close();
  }
  for (const [query, text] of [
    ["", "Відкрийте посилання з листа"],
    ["?token=bad", "Посилання має неправильний формат"],
  ]) {
    const f = await fixture(query);
    try {
      await f.page.getByText(new RegExp(text)).waitFor();
      await f.page.locator("#fixture-remount").click();
      assert.equal(await confirm(f.page).count(), 0);
      assert.equal(
        await f.page.evaluate(() => window.fixtureRequests.length),
        0,
      );
      assert.deepEqual(f.errors, []);
      results.push(text);
    } finally {
      await f.context.close();
    }
  }
  for (const mode of ["temporary", "invalid"]) {
    const f = await fixture(`?token=${token}`, mode);
    try {
      await confirm(f.page).click();
      await f.page.getByRole("alert").waitFor();
      await f.page.locator("#fixture-restore").click();
      await f.page
        .locator("#fixture-owner")
        .getByText("synthetic-owner-a", { exact: true })
        .waitFor();
      await f.page.locator("#fixture-remount").click();
      if (mode === "temporary") {
        await confirm(f.page).click();
        await f.page
          .getByText("Електронну пошту підтверджено!", { exact: true })
          .waitFor();
        assert.deepEqual(await f.page.evaluate(() => window.fixtureRequests), [
          { token },
          { token },
        ]);
      } else assert.equal(await confirm(f.page).count(), 0);
      assert.deepEqual(f.errors, []);
      results.push(`${mode}: credential lifetime across page replacement`);
    } finally {
      await f.context.close();
    }
  }
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify(
      { kind: "offline React DOM, not live Next.js", results },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
