import type { ComponentProps } from "react";
import { SafeImage } from "@/shared/ui/safe-image";
import { ListingPlaceholder } from "./listing-placeholder";
export function ListingImage({
  species,
  ...props
}: ComponentProps<"img"> & { species: string; alt: string }) {
  return (
    <SafeImage
      {...props}
      fallback={
        <ListingPlaceholder
          species={species}
          caption="Фото тимчасово недоступне"
        />
      }
    />
  );
}
