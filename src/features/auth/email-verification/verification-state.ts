import { ApiError } from "@/shared/api/client";

export type ConfirmationStatus =
  | "loading"
  | "missing"
  | "malformed"
  | "ready"
  | "pending"
  | "success"
  | "invalid"
  | "temporary"
  | "limited";
export type ConfirmationState = { status: ConfirmationStatus; retryAt: number };
const initial: ConfirmationState = { status: "loading", retryAt: 0 };

/** Per-page memory only. The credential is deliberately absent from public snapshots. */
export function createConfirmationState(
  confirm: (token: string) => Promise<void>,
  now = Date.now,
) {
  let state = initial,
    token: string | null = null,
    captured = false;
  const listeners = new Set<() => void>();
  const update = (status: ConfirmationStatus, retryAt = 0) => {
    state = { status, retryAt };
    listeners.forEach((listener) => listener());
  };
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => state,
    serverSnapshot: () => initial,
    capture(
      location: Pick<Location, "search" | "pathname">,
      history: Pick<History, "replaceState">,
    ) {
      if (captured) return;
      captured = true;
      const tokens = new URLSearchParams(location.search).getAll("token");
      // Commit the in-memory credential before history can trigger router work.
      if (!tokens.length) update("missing");
      else if (tokens.length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(tokens[0]))
        update("malformed");
      else {
        token = tokens[0];
        update("ready");
      }
      // Use Next's supported public History integration. Passing its private
      // __NA history state skips router synchronization in Next 16.3.
      history.replaceState(null, "", location.pathname);
    },
    async submit() {
      if (!token || state.status === "pending" || now() < state.retryAt) return;
      update("pending");
      try {
        await confirm(token);
        token = null;
        update("success");
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          token = null;
          update("invalid");
        } else if (error instanceof ApiError && error.status === 429)
          update(
            "limited",
            error.retryAfterSeconds
              ? now() + error.retryAfterSeconds * 1000
              : 0,
          );
        else update("temporary");
      }
    },
  };
}

export type ResendState = {
  status:
    | "idle"
    | "pending"
    | "accepted"
    | "already_verified"
    | "limited"
    | "temporary"
    | "unauthenticated";
  retryAt: number;
};
const resendInitial: ResendState = { status: "idle", retryAt: 0 };
export function createResendState(
  send: () => Promise<"accepted" | "already_verified">,
  isCurrent: () => boolean,
  now = Date.now,
) {
  let state = resendInitial;
  const listeners = new Set<() => void>();
  const update = (next: ResendState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => state,
    serverSnapshot: () => resendInitial,
    async submit() {
      if (
        !isCurrent() ||
        state.status === "pending" ||
        state.status === "already_verified" ||
        now() < state.retryAt
      )
        return;
      update({ status: "pending", retryAt: 0 });
      try {
        const status = await send();
        if (isCurrent())
          update({
            status,
            retryAt: status === "accepted" ? now() + 60000 : 0,
          });
      } catch (error) {
        if (!isCurrent()) return;
        update({
          status:
            error instanceof ApiError && error.status === 429
              ? "limited"
              : error instanceof ApiError && error.status === 401
                ? "unauthenticated"
                : "temporary",
          retryAt:
            error instanceof ApiError &&
            error.status === 429 &&
            error.retryAfterSeconds
              ? now() + error.retryAfterSeconds * 1000
              : 0,
        });
      }
    },
  };
}
