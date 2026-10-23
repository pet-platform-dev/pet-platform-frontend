// Synthetic offline fixture, never imported by the application.
import { StrictMode, useEffect, useState } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { useQueryClient } from "@tanstack/react-query";
import {
  SessionProvider,
  useSession,
} from "../../src/features/auth/session-provider";
import { FavoriteProvider } from "../../src/features/favorites/favorite-provider";
import { EmailConfirmation } from "../../src/features/auth/email-verification/confirmation";
import VerifyEmailLayout from "../../src/app/verify-email/layout";

function Fixture() {
  const client = useQueryClient();
  const session = useSession();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.strictSetups = String(
      Number(root.dataset.strictSetups ?? 0) + 1,
    );
  }, []);
  const [revision, setRevision] = useState(0);
  const [renderCount, setRenderCount] = useState(0);
  return (
    <>
      <span id="fixture-owner">{session.data?.id ?? "guest"}</span>
      <button
        id="fixture-restore"
        onClick={() => window.dispatchEvent(new Event("fixture-restore"))}
      >
        Restore session
      </button>
      <button
        id="fixture-switch"
        onClick={() =>
          client.setQueryData(["current-user"], { id: "synthetic-owner-b" })
        }
      >
        Switch account
      </button>
      <button
        id="fixture-logout"
        onClick={() => client.setQueryData(["current-user"], null)}
      >
        Logout
      </button>
      <EmailConfirmation key={revision} />
      <button
        id="fixture-rerender"
        onClick={() => setRenderCount((value) => value + 1)}
      >
        Rerender {renderCount}
      </button>
      <button
        id="fixture-remount"
        onClick={() => setRevision((value) => value + 1)}
      >
        Replace page subtree
      </button>
    </>
  );
}
const tree = (
  <StrictMode>
    <SessionProvider>
      <FavoriteProvider>
        <VerifyEmailLayout>
          <Fixture />
        </VerifyEmailLayout>
      </FavoriteProvider>
    </SessionProvider>
  </StrictMode>
);

// SSR markup + hydration with the actual root favorites boundary, not a Next server.
const root = document.getElementById("root")!;
if (new URLSearchParams(window.location.search).has("strictMount")) {
  createRoot(root).render(tree);
} else {
  root.innerHTML = renderToString(tree);
  hydrateRoot(root, tree);
}
