import {
  loadLegalMetadata,
  matchesLegalContent,
  type LegalAcceptance,
  type LegalMetadata,
} from "./legal-metadata";

export type RegistrationLegalState = {
  status: "loading" | "ready" | "error" | "mismatch";
  metadata: LegalMetadata | null;
  checked: boolean;
  error: string;
  changed: boolean;
};
const initial: RegistrationLegalState = {
  status: "loading",
  metadata: null,
  checked: false,
  error: "",
  changed: false,
};

// Per-form, memory-only state. Request generations fence late metadata responses.
export function createRegistrationLegalState(
  load = loadLegalMetadata,
  matches = matchesLegalContent,
) {
  let state = initial;
  let generation = 0;
  let request: AbortController | undefined;
  const listeners = new Set<() => void>();
  const update = (next: RegistrationLegalState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const cancel = () => {
    generation++;
    request?.abort();
  };
  return {
    snapshot: () => state,
    serverSnapshot: () => initial,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    cancel,
    async refresh(changed = state.changed) {
      cancel();
      const current = generation;
      request = new AbortController();
      update({ ...initial, changed });
      try {
        const metadata = await load(request.signal);
        if (current !== generation) return;
        update({
          ...initial,
          changed,
          status: matches(metadata) ? "ready" : "mismatch",
          metadata,
        });
      } catch {
        if (current === generation)
          update({ ...initial, changed, status: "error" });
      }
    },
    check(checked: boolean) {
      if (state.status === "ready" && state.metadata?.acceptanceRequired)
        update({ ...state, checked, error: checked ? "" : state.error });
    },
    acceptance():
      { ok: true; legalAcceptance?: LegalAcceptance } | { ok: false } {
      if (state.status !== "ready" || !state.metadata) return { ok: false };
      if (!state.metadata.acceptanceRequired) return { ok: true };
      if (!state.checked) {
        update({
          ...state,
          error:
            "Ознайомтеся з документами та підтвердьте згоду з Умовами користування.",
        });
        return { ok: false };
      }
      return {
        ok: true,
        legalAcceptance: {
          accepted: true,
          termsVersion: state.metadata.terms.version,
          privacyVersion: state.metadata.privacy.version,
        },
      };
    },
  };
}
