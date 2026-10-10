"use client";
/* eslint-disable @next/next/no-img-element -- Provider delivery URLs already resize and optimize images. */
import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";

export function SafeImage({
  fallback,
  alt,
  ...props
}: ComponentProps<"img"> & { fallback?: React.ReactNode; alt: string }) {
  const [failedSource, setFailedSource] = useState<string>();
  const element = useRef<HTMLImageElement>(null);
  useEffect(() => {
    let mounted = true;
    const source = String(props.src ?? "");
    // SSR images can fail before React attaches onError. decode also detects that failure.
    void element.current?.decode().catch(() => {
      if (mounted) setFailedSource(source);
    });
    return () => {
      mounted = false;
    };
  }, [props.src]);
  if (!props.src || failedSource === props.src)
    return (
      fallback ?? (
        <div
          className="image-fallback"
          role="img"
          aria-label="Фото тимчасово недоступне"
        >
          Фото тимчасово недоступне
        </div>
      )
    );
  return (
    <img
      {...props}
      ref={element}
      alt={alt}
      onError={() => setFailedSource(String(props.src))}
    />
  );
}
