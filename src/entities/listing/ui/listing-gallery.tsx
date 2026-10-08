"use client";
/* eslint-disable @next/next/no-img-element -- Provider URLs already resize and optimize images. */
import { useState } from "react";
import type { Listing } from "../model/listing";
import { listingHeading } from "../model/presentation";
import { ListingPlaceholder } from "./listing-placeholder";
export function ListingGallery({ listing }: { listing: Listing }) {
  const [selected, setSelected] = useState(0);
  if (!listing.images?.length)
    return <ListingPlaceholder species={listing.pet.species.slug} />;
  const heading = listingHeading(listing.pet),
    image = listing.images[selected] ?? listing.images[0];
  return (
    <div className="listing-gallery">
      <img
        className="listing-gallery-main"
        src={image.url}
        alt={`${heading} — фото ${selected + 1}`}
        width="1200"
        height="900"
        fetchPriority="high"
      />
      {listing.images.length > 1 && (
        <div
          className="listing-gallery-thumbnails"
          aria-label="Фотографії тварини"
        >
          {listing.images.map((image, index) => (
            <button
              type="button"
              key={image.id}
              aria-label={`Показати фото ${index + 1}`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
            >
              <img
                src={image.thumbnailUrl}
                alt={`${heading} — фото ${index + 1}`}
                width="120"
                height="90"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
