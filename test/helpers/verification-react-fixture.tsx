// Synthetic offline fixture, never imported by the application.
import { StrictMode, useEffect, useState, useSyncExternalStore } from "react";
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
import ResetPasswordLayout from "../../src/app/reset-password/layout";
import { ResetPassword } from "../../src/features/auth/password-recovery/reset-password";
import ChangeLayout from "../../src/app/confirm-email-change/layout";
import { EmailChangeConfirmation } from "../../src/features/auth/email-change/confirmation";
import {
  ClaimSession as ClaimLayout,
  useClaimSession,
} from "../../src/features/breeder/claim/claim-session";

const resetting = window.location.pathname === "/reset-password";
const changingEmail = window.location.pathname === "/confirm-email-change";
const claiming = window.location.pathname === "/claim-breeder";
const RouteLayout = claiming
  ? ClaimLayout
  : changingEmail
    ? ChangeLayout
    : resetting
      ? ResetPasswordLayout
      : VerifyEmailLayout;

function ClaimFixture() {
  const controller = useClaimSession(),
    session = useSession();
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.serverSnapshot,
  );
  useEffect(
    () => controller.session(session.data?.id ?? ""),
    [controller, session.data?.id],
  );
  return (
    <section>
      <span id="claim-state">{state.status}</span>
      {state.preview && <p>{state.preview.kennelName}</p>}
      <button
        id="claim-preview"
        disabled={!session.data || state.status === "pending"}
        onClick={() => void controller.inspect()}
      >
        Preview invitation
      </button>
      <button
        id="claim-accept"
        disabled={state.status !== "preview"}
        onClick={() => void controller.accept()}
      >
        Accept invitation
      </button>
    </section>
  );
}

function Fixture() {
  const client = useQueryClient();
  const session = useSession();
  const switchAccount = (id: string | null) => {
    window.dispatchEvent(new CustomEvent("fixture-account", { detail: id }));
    client.setQueryData(["current-user"], id ? { id } : null);
  };
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
        onClick={() => switchAccount("synthetic-owner-b")}
      >
        Switch account
      </button>
      <button id="fixture-logout" onClick={() => switchAccount(null)}>
        Logout
      </button>
      {claiming ? (
        <ClaimFixture key={revision} />
      ) : changingEmail ? (
        <EmailChangeConfirmation key={revision} />
      ) : resetting ? (
        <ResetPassword key={revision} />
      ) : (
        <EmailConfirmation key={revision} />
      )}
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
        <RouteLayout>
          <Fixture />
        </RouteLayout>
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
