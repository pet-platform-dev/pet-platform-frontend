import type { Breeder } from "@/entities/breeder/model";
export function BreederProfileDetails({ profile }: { profile: Breeder }) {
  if (!profile.startedYear && !profile.website) return null;
  return (
    <div className="breeder-profile-details">
      {profile.startedYear && (
        <section
          className="listing-detail-panel"
          aria-labelledby="breeder-experience"
        >
          <h2 id="breeder-experience">Досвід</h2>
          <p>Працює з {profile.startedYear} року</p>
        </section>
      )}
      {profile.website && (
        <section
          className="listing-detail-panel"
          aria-labelledby="breeder-website"
        >
          <h2 id="breeder-website">Вебсайт</h2>
          <a
            className="breeder-website-link"
            href={profile.website}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Вебсайт розплідника (відкриється в новій вкладці)"
          >
            {profile.website}
          </a>
        </section>
      )}
    </div>
  );
}
