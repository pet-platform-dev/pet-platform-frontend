"use client";
import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

// Keep menus in their existing DOM/focus/dialog tree. Measure the anchor, not
// the field wrapper (which also contains selected values and helper text).
export function useDropdownOverlay(
  present: boolean,
  root: RefObject<HTMLElement | null>,
  anchor: RefObject<HTMLElement | null>,
  menu: RefObject<HTMLElement | null>,
  minWidth = 0,
  maxHeight = 384,
) {
  const [style, setStyle] = useState<CSSProperties>({
    position: "absolute",
    visibility: "hidden",
  });
  useLayoutEffect(() => {
    if (!present || !root.current || !anchor.current || !menu.current) return;
    const container = root.current,
      control = anchor.current,
      surface = menu.current;
    function update() {
      const rect = control.getBoundingClientRect(),
        base = container.getBoundingClientRect();
      const viewport = window.visualViewport;
      let left = (viewport?.offsetLeft ?? 0) + 8;
      let right = left + (viewport?.width ?? innerWidth) - 16;
      let top = (viewport?.offsetTop ?? 0) + 8;
      let bottom = top + (viewport?.height ?? innerHeight) - 16;
      const header = document.querySelector<HTMLElement>(".site-header");
      if (header && !container.closest("dialog[open]")) {
        const bounds = header.getBoundingClientRect();
        if (
          ["sticky", "fixed"].includes(getComputedStyle(header).position) &&
          bounds.top <= top
        )
          top = Math.max(top, bounds.bottom + 8);
      }
      // An absolute menu must also fit scrollable drawers and clipped panels.
      for (
        let parent = container.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        const css = getComputedStyle(parent),
          bounds = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(css.overflowY)) {
          top = Math.max(top, bounds.top + parent.clientTop + 8);
          bottom = Math.min(
            bottom,
            bounds.top + parent.clientTop + parent.clientHeight - 8,
          );
        }
        if (/(auto|scroll|hidden|clip)/.test(css.overflowX)) {
          left = Math.max(left, bounds.left + parent.clientLeft + 8);
          right = Math.min(
            right,
            bounds.left + parent.clientLeft + parent.clientWidth - 8,
          );
        }
      }
      const below = Math.max(0, bottom - rect.bottom - 8);
      const above = Math.max(0, rect.top - top - 8);
      const upward =
        below < Math.min(surface.scrollHeight, maxHeight) && above > below;
      const width = Math.max(
        0,
        Math.min(Math.max(rect.width, minWidth), right - left),
      );
      const next: CSSProperties = {
        position: "absolute",
        visibility: "visible",
        zIndex: "var(--layer-dropdown)",
        margin: 0,
        minWidth: 0,
        width,
        right: "auto",
        left:
          Math.max(left, Math.min(rect.left, right - width)) -
          base.left +
          container.scrollLeft,
        top: upward ? "auto" : rect.bottom - base.top + container.scrollTop + 8,
        bottom: upward
          ? base.bottom - rect.top - container.scrollTop + 8
          : "auto",
        maxHeight: Math.min(maxHeight, upward ? above : below),
      };
      setStyle((old) =>
        JSON.stringify(old) === JSON.stringify(next) ? old : next,
      );
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(control);
    observer.observe(surface);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [present, root, anchor, menu, minWidth, maxHeight]);
  return style;
}
