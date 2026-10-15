"use client";
import { useEffect, useState } from "react";
/** Retain only the closing visual surface; callers hide it from accessibility and make it inert immediately. */
export function useMotionPresence(open: boolean): boolean {
  const [state, setState] = useState({ open, present: open });
  if (state.open !== open) setState({ open, present: open || state.present });
  useEffect(() => {
    if (state.open || !state.present) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () =>
      setState((current) =>
        current.open ? current : { ...current, present: false },
      );
    const reduced = () => {
      if (media.matches) {
        clearTimeout(timer);
        finish();
      }
    };
    const timer = setTimeout(finish, media.matches ? 0 : 160);
    media.addEventListener("change", reduced);
    return () => {
      clearTimeout(timer);
      media.removeEventListener("change", reduced);
    };
  }, [state.open, state.present]);
  return state.present;
}
