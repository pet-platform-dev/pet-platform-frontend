"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { currentSessionGeneration } from "@/shared/api/client";
import { createConfirmationState } from "../email-verification/verification-state";
import { refreshVerificationSession } from "../email-verification/session-sync";
import { notifySessionChange } from "../session-provider";
import { confirmEmailChange } from "./api";
const Context = createContext<ReturnType<
  typeof createConfirmationState<void>
> | null>(null);
export function EmailChangeSession({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = useQueryClient();
  const [controller] = useState(() =>
    createConfirmationState(async (token: string) => {
      const generation = currentSessionGeneration();
      await confirmEmailChange(token);
      try {
        await refreshVerificationSession(client, generation);
      } catch {
        /* Committed change; normal session refetch may retry. */
      }
      notifySessionChange("email-change");
    }),
  );
  useEffect(() => {
    controller.capture(window.location, window.history);
  }, [controller]);
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function useEmailChangeSession() {
  const controller = useContext(Context);
  if (!controller) throw Error("Email change requires its route session");
  return controller;
}
