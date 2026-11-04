import assert from "node:assert/strict";
import { test } from "node:test";
import { load } from "./helpers/load-frontend.mjs";
const { proxyApi } = await load("src/shared/api/proxy.ts");
test("S5 3 MiB multipart upload crosses the existing same-origin proxy without binary or auth changes", async () => {
  const bytes = Buffer.alloc(3 * 1024 * 1024);
  Buffer.from("89504e470d0a1a0a", "hex").copy(bytes);
  const form = new FormData();
  form.set("type", "IMAGE");
  form.set("expectedUpdatedAt", "2026-11-05T10:00:00.000Z");
  form.set("file", new Blob([bytes], { type: "image/png" }), "photo.png");
  const request = new Request(
    "https://frontend.example/api/v1/service-workspace/providers/provider-id/media/uploads",
    {
      method: "POST",
      headers: {
        origin: "https://frontend.example",
        "sec-fetch-site": "same-origin",
        authorization: "Bearer synthetic",
        "x-csrf-token": "synthetic",
        cookie: "pet_csrf=synthetic",
      },
      body: form,
    },
  );
  const response = await proxyApi(
    request,
    ["service-workspace", "providers", "provider-id", "media", "uploads"],
    {
      NEXT_PUBLIC_API_PROXY_ENABLED: "true",
      API_PROXY_FRONTEND_ORIGIN: "https://frontend.example",
      API_PROXY_BACKEND_ORIGIN: "https://backend.example",
    },
    async (url, init) => {
      assert.equal(
        String(url),
        "https://backend.example/api/v1/service-workspace/providers/provider-id/media/uploads",
      );
      assert.equal(init.headers.get("origin"), "https://frontend.example");
      assert.equal(init.headers.get("authorization"), "Bearer synthetic");
      assert.equal(init.headers.get("x-csrf-token"), "synthetic");
      assert.equal(init.headers.get("cookie"), "pet_csrf=synthetic");
      const forwarded = new Request(url, init);
      const payload = await forwarded.arrayBuffer();
      assert.ok(payload.byteLength < 4_500_000);
      const parsed = await new Request(url, {
        method: "POST",
        headers: init.headers,
        body: payload,
      }).formData();
      assert.equal(parsed.get("type"), "IMAGE");
      assert.deepEqual(
        Buffer.from(await parsed.get("file").arrayBuffer()),
        bytes,
      );
      return Response.json({ data: { items: [] } }, { status: 201 });
    },
  );
  assert.equal(response.status, 201);
});
