"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { createClaimState } from "./claim-state";
import { previewClaim, acceptClaim } from "./api";
const ClaimContext = createContext<ReturnType<typeof createClaimState> | null>(
  null,
);
export function ClaimSession({ children }: { children: React.ReactNode }) {
  const [controller] = useState(() =>
    createClaimState(previewClaim, acceptClaim),
  );
  useEffect(() => {
    controller.capture(window.location, window.history);
  }, [controller]);
  return (
    <ClaimContext.Provider value={controller}>{children}</ClaimContext.Provider>
  );
}
export function useClaimSession() {
  const value = useContext(ClaimContext);
  if (!value) throw Error("Claim session is required");
  return value;
}
