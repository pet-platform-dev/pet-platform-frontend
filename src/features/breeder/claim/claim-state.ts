import { ApiError } from "@/shared/api/client";
import type { ClaimPreview } from "./api";
type ClaimState = {
  status:
    | "loading"
    | "missing"
    | "malformed"
    | "ready"
    | "pending"
    | "preview"
    | "success"
    | "error"
    | "invalid";
  preview: ClaimPreview | null;
  message: string;
  sessionKey: string;
};
const initial: ClaimState = {
  status: "loading",
  preview: null,
  message: "",
  sessionKey: "",
};
/** A route instance owns the secret. Public snapshots never contain it. */
export function createClaimState(
  preview: (token: string) => Promise<ClaimPreview>,
  accept: (
    token: string,
    revision: string,
    packageRevision: string,
  ) => Promise<{ ownerId: string }>,
) {
  let token: string | null = null,
    captured = false,
    state = initial,
    identity = "",
    epoch = 0;
  const listeners = new Set<() => void>();
  const update = (v: Partial<ClaimState>) => {
    state = { ...state, ...v };
    listeners.forEach((fn) => fn());
  };
  return {
    snapshot: () => state,
    serverSnapshot: () => initial,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    capture(
      location: Pick<Location, "search" | "pathname">,
      history: Pick<History, "replaceState">,
    ) {
      if (captured) return;
      captured = true;
      const values = new URLSearchParams(location.search).getAll("token");
      token =
        values.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(values[0])
          ? values[0]
          : null;
      update({
        status: token ? "ready" : values.length ? "malformed" : "missing",
      });
      history.replaceState(null, "", location.pathname);
    },
    session(key: string) {
      if (key === identity) return;
      identity = key;
      epoch++;
      update({
        sessionKey: key,
        preview: null,
        message: "",
        status: token
          ? "ready"
          : state.status === "success"
            ? "success"
            : state.status,
      });
    },
    async inspect() {
      if (!token || !identity || state.status === "pending") return;
      const run = epoch;
      update({ status: "pending", message: "", preview: null });
      try {
        const data = await preview(token);
        if (run === epoch) update({ status: "preview", preview: data });
      } catch (error) {
        if (run === epoch) {
          if (error instanceof ApiError && error.status === 400) token = null;
          update({
            status: token ? "error" : "invalid",
            message:
              error instanceof ApiError
                ? error.message
                : "Не вдалося завантажити запрошення. Спробуйте ще раз.",
          });
        }
      }
    },
    async accept() {
      if (
        !token ||
        !identity ||
        !state.preview ||
        !state.preview.package.canAccept ||
        state.status !== "preview"
      )
        return null;
      const run = epoch,
        revision = state.preview.draftRevision;
      update({ status: "pending", message: "" });
      try {
        const result = await accept(
          token,
          revision,
          state.preview!.package.revision,
        );
        token = null;
        if (run !== epoch) {
          update({ status: "invalid", preview: null, message: "" });
          return null;
        }
        update({ status: "success", preview: null });
        return result;
      } catch (error) {
        if (run === epoch) {
          if (error instanceof ApiError && error.status === 400) token = null;
          update({
            status: token ? "error" : "invalid",
            preview: null,
            message:
              error instanceof ApiError
                ? error.message
                : "Не вдалося прийняти профіль. Повторіть перегляд і спробуйте ще раз.",
          });
        }
        return null;
      }
    },
  };
}
