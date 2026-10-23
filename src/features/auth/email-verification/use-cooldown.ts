"use client";
import { useEffect, useState } from "react";

export function useCooldown(retryAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!retryAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(() => {
      tick();
      if (Date.now() >= retryAt) window.clearInterval(interval);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [retryAt]);
  return retryAt ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0;
}
