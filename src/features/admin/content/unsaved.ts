"use client";
import { useEffect } from "react";
export function useContentUnsaved(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.("a[href]");
      if (
        a &&
        !(e.ctrlKey || e.metaKey || e.shiftKey) &&
        !window.confirm("Незбережені зміни буде втрачено. Залишити сторінку?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
}
