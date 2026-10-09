export function ListingManagementSkeleton({
  editor = false,
}: {
  editor?: boolean;
}) {
  return (
    <div role="status" aria-label="Завантажуємо оголошення">
      <span className="sr-only">Завантажуємо оголошення…</span>
      <div
        aria-hidden="true"
        className={
          editor ? "pet-form-card owner-editor-skeleton" : "owner-listings"
        }
      >
        {Array.from({ length: editor ? 1 : 3 }, (_, index) => (
          <div key={index} className={editor ? "" : "owner-listing-skeleton"}>
            {!editor && <div className="owner-cover skeleton-block" />}
            <div className="owner-card-body">
              <div className="skeleton-line skeleton-badge" />
              <div className="skeleton-line skeleton-name" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-short" />
              {editor &&
                Array.from({ length: 4 }, (_, field) => (
                  <div
                    className="skeleton-block owner-skeleton-input"
                    key={field}
                  />
                ))}
              <div className="skeleton-line" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
