import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
export async function runClaimLifecycle(browser, output) {
  const require = createRequire(import.meta.url),
    { webpack } = require("next/dist/compiled/webpack/webpack");
  await new Promise((yes, no) => {
    const compiler = webpack({
      mode: "development",
      target: "web",
      devtool: false,
      entry: resolve("test/helpers/verification-react-fixture.tsx"),
      output: { path: resolve(output), filename: "claim-lifecycle.js" },
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
          no(Error(stats.toString({ all: false, errors: true })));
        else yes();
      }),
    );
  });
  const bundle = await readFile(resolve(output, "claim-lifecycle.js"), "utf8"),
    token = "s".repeat(43);
  for (const strictMount of [false, true]) {
    const context = await browser.newContext();
    await context.route("**/*", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html lang="uk"><body><div id="root"></div></body></html>',
      }),
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto(
        `http://localhost:3017/claim-breeder?token=${token}${strictMount ? "&strictMount=1" : ""}`,
      );
      await page.evaluate(() => {
        window.claimRequests = [];
        window.claimAttempts = 0;
        window.fixtureAccount = "synthetic-owner-a";
        window.addEventListener("fixture-account", (event) => {
          window.fixtureAccount = event.detail;
        });
        window.fetch = async (url, init) => {
          const path = new URL(url).pathname;
          if (path.endsWith("/auth/csrf"))
            return Response.json({ data: { csrfToken: "synthetic-csrf" } });
          if (path.endsWith("/auth/refresh")) {
            await new Promise((resolve) =>
              window.addEventListener("fixture-restore", resolve, {
                once: true,
              }),
            );
            return Response.json({
              data: {
                user: { id: window.fixtureAccount },
                accessToken: "synthetic-access",
                expiresIn: 900,
              },
            });
          }
          if (path.endsWith("/auth/me"))
            return Response.json({ data: { id: window.fixtureAccount } });
          if (path.endsWith("/breeder-claims/preview")) {
            window.claimRequests.push(JSON.parse(init.body));
            return Response.json({
              data: {
                kennelName: "Синтетичний профіль",
                description: null,
                website: null,
                startedYear: null,
                expiresAt: "2026-11-01T00:00:00Z",
                draftRevision: "2026-10-24T00:00:00Z",
                location: null,
                package: {
                  revision: "a".repeat(64),
                  count: 0,
                  canAccept: true,
                  blockers: [],
                  listings: [],
                },
              },
            });
          }
          if (path.endsWith("/breeder-claims/accept")) {
            window.claimRequests.push(JSON.parse(init.body));
            window.claimAttempts++;
            await new Promise((resolve) => setTimeout(resolve, 80));
            if (window.claimAttempts === 1)
              return Response.json({}, { status: 503 });
            return Response.json({
              data: {
                profileId: "22222222-2222-4222-8222-222222222222",
                ownerId: "11111111-1111-4111-8111-111111111111",
                redirectTo: "/my-listings",
              },
            });
          }
          throw Error("Unexpected synthetic lifecycle request");
        };
      });
      await page.addScriptTag({ content: bundle });
      await page.waitForURL("http://localhost:3017/claim-breeder");
      assert.equal(await page.locator("#claim-state").textContent(), "ready");
      assert.deepEqual(await page.evaluate(() => window.claimRequests), []);
      await page.locator("#fixture-restore").click();
      await page
        .locator("#fixture-owner")
        .filter({ hasText: "synthetic-owner-a" })
        .waitFor();
      await page.locator("#fixture-rerender").click();
      await page.locator("#claim-preview").click();
      await page
        .locator("#claim-state")
        .filter({ hasText: "preview" })
        .waitFor();
      await page.locator("#fixture-remount").click();
      await page
        .locator("#claim-state")
        .filter({ hasText: "preview" })
        .waitFor();
      await page.locator("#claim-accept").evaluate((b) => {
        b.click();
        b.click();
      });
      await page.locator("#claim-state").filter({ hasText: "error" }).waitFor();
      assert.equal(await page.evaluate(() => window.claimAttempts), 1);
      await page.locator("#fixture-switch").click();
      await page.locator("#claim-state").filter({ hasText: "ready" }).waitFor();
      assert.equal(
        await page.getByText("Синтетичний профіль", { exact: true }).count(),
        0,
      );
      await page.locator("#claim-preview").click();
      await page
        .locator("#claim-state")
        .filter({ hasText: "preview" })
        .waitFor();
      await page.locator("#claim-accept").click();
      await page
        .locator("#claim-state")
        .filter({ hasText: "success" })
        .waitFor();
      assert.equal(await page.evaluate(() => window.claimAttempts), 2);
      assert(
        (await page.evaluate(() => window.claimRequests)).every(
          (v) => v.token === token,
        ),
      );
      assert(
        !(await page.evaluate(
          (token) =>
            JSON.stringify({ ...localStorage, ...sessionStorage }).includes(
              token,
            ),
          token,
        )),
      );
      if (strictMount)
        assert(
          Number(
            await page.locator("html").getAttribute("data-strict-setups"),
          ) >= 2,
        );
      assert.deepEqual(errors, []);
      await page.reload();
      await page.addScriptTag({ content: bundle });
      await page
        .locator("#claim-state")
        .filter({ hasText: "missing" })
        .waitFor();
    } finally {
      await context.close();
    }
  }
  return {
    strictMode: true,
    hydration: true,
    subtreeRemount: true,
    delayedRestore: true,
    transientRetry: true,
    sessionIsolation: true,
    fullReloadMissing: true,
  };
}
