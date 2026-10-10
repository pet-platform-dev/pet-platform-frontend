"use client";
import { useEffect, useRef, type KeyboardEvent } from "react";
export const catalogDesktopMedia = "(min-width: 1024px)";
export function useFilterDialog(onClose: () => void) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current,
      opener = document.activeElement;
    const root = document.documentElement,
      body = document.body;
    const rootOverflow = root.style.overflow,
      bodyOverflow = body.style.overflow;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    element?.showModal();
    element?.querySelector<HTMLButtonElement>("[data-drawer-close]")?.focus();
    const desktop = window.matchMedia(catalogDesktopMedia);
    const resize = () => {
      if (desktop.matches) onClose();
    };
    desktop.addEventListener("change", resize);
    resize();
    return () => {
      desktop.removeEventListener("change", resize);
      element?.close();
      root.style.overflow = rootOverflow;
      body.style.overflow = bodyOverflow;
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, [onClose]);
  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const nodes = dialog.current?.querySelectorAll<HTMLElement>(
      "button:not(:disabled):not([tabindex='-1']),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex='0']",
    );
    const visible = Array.from(nodes ?? []).filter(
        (node) => node.getClientRects().length > 0,
      ),
      first = visible[0],
      last = visible[visible.length - 1];
    if (
      first &&
      last &&
      ((event.shiftKey && document.activeElement === first) ||
        (!event.shiftKey && document.activeElement === last))
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }
  return { dialog, trapFocus };
}
