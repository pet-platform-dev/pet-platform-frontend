import Link from "next/link";
import type { BreederDirectoryCard as Card } from "@/entities/breeder/directory";
import { breedLabel } from "@/entities/breed/model";
import { breederImageUrl } from "@/entities/breeder/media";
import { SafeImage } from "@/shared/ui/safe-image";
export function BreederCard({ breeder }: { breeder: Card }) {
  const fallback = (
    <span className="breeder-directory-avatar" aria-hidden="true">
      {Array.from(breeder.kennelName.trim())[0]?.toLocaleUpperCase("uk-UA")}
    </span>
  );
  return (
    <article>
      <Link
        className="breeder-directory-card"
        href={`/sellers/${breeder.userId}`}
        aria-label={`Переглянути розплідник ${breeder.kennelName}`}
      >
        <div className="breeder-directory-identity">
          {breeder.logo ? (
            <SafeImage
              src={breederImageUrl(breeder.logo.url, 192)}
              width={56}
              height={56}
              alt=""
              loading="lazy"
              fallback={fallback}
            />
          ) : (
            fallback
          )}
          <h2>{breeder.kennelName}</h2>
        </div>
        {breeder.location && (
          <p className="breeder-directory-location">
            {breeder.location.city}, {breeder.location.region}
          </p>
        )}
        {breeder.breeds.length > 0 && (
          <p className="breeder-directory-breeds">
            {breeder.breeds.map(breedLabel).join(", ")}
          </p>
        )}
        {breeder.description && (
          <p className="breeder-directory-description">{breeder.description}</p>
        )}
        <span className="breeder-directory-cta">
          Переглянути розплідник <span aria-hidden="true">→</span>
        </span>
      </Link>
    </article>
  );
}
