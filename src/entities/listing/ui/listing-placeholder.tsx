export function ListingPlaceholder({
  species,
  caption = "Фото ще не додано",
}: {
  species: string;
  caption?: string;
}) {
  return (
    <div
      className={`listing-visual ${species === "cat" ? "listing-visual-cat" : "listing-visual-dog"}`}
    >
      <svg
        viewBox="0 0 180 160"
        className="listing-silhouette"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <ellipse
          cx="90"
          cy="132"
          rx="55"
          ry="5"
          fill="currentColor"
          opacity=".09"
        />
        {species === "cat" ? (
          <g
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M59 75 58 39 78 54c9-4 18-4 26 0l20-15-2 36c0 20-15 31-32 31S59 95 59 75Z" />
            <path d="M71 102c-7 14-11 26-5 28h44c5-2 3-14-5-27M110 129c34 3 37-19 24-22-10-3-16 5-12 12" />
            <path d="m57 83-15-3m16 10-17 3m81-10 15-3m-16 10 17 3M87 87l3 3 3-3" />
            <path d="M77 75h1m24 0h1M79 119v10m22-10v10" />
          </g>
        ) : (
          <g
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M66 58c10-7 33-7 43 0l7 26c0 18-12 28-27 28S62 102 62 84l4-26Z" />
            <path d="M66 57c-17-11-26 14-18 28 4 8 10 5 14-1m47-27c17-11 26 14 18 28-4 8-10 5-14-1M74 109l-6 20h43l-6-21M111 129c17 0 29-10 24-22M80 120v9m19-9v9" />
            <path d="M75 77h1m24 0h1M84 90l5 4 5-4m-5 4v7m-8-2c5 5 12 5 16 0" />
          </g>
        )}
      </svg>
      <span className="listing-no-photo">{caption}</span>
    </div>
  );
}
