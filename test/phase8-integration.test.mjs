import { test } from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { load } from "./helpers/load-frontend.mjs";
const { clearPrivateQueries } = await load(
  "src/features/auth/session-provider.tsx",
);
for (const family of ["favorites", "favorite-batch", "seller-review-me"])
  test(
    "late " +
      family +
      " read cannot repopulate private state after account switch",
    async () => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      client.setQueryData(["current-user"], { id: "A" });
      const key = [family, "A", "target"];
      let release;
      const result = client
        .fetchQuery({
          queryKey: key,
          queryFn: () => new Promise((resolve) => (release = resolve)),
        })
        .catch(() => undefined);
      clearPrivateQueries(client);
      client.setQueryData(["current-user"], { id: "B" });
      release({ private: "A" });
      await result;
      assert.equal(client.getQueryData(key), undefined);
      assert.equal(client.getQueryData([family, "B", "target"]), undefined);
      assert.equal(client.getQueryData(["current-user"]).id, "B");
      client.clear();
    },
  );
