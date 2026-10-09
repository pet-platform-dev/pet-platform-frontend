"use client";
/* eslint-disable @next/next/no-img-element -- Provider delivery URLs already resize and optimize images. */
import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { ListingPlaceholder } from "./listing-placeholder";

export function ListingImage({
  species,
  alt,
  ...props
}: ComponentProps<"img"> & { species: string; alt: string }) {
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
      <ListingPlaceholder
        species={species}
        caption="Фото тимчасово недоступне"
      />
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
