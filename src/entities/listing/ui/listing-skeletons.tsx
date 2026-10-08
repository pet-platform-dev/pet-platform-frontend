export function ListingSkeletons() {
  return (
    <div role="status" aria-label="Завантажуємо оголошення">
      <span className="sr-only">Завантажуємо оголошення…</span>
      <div className="listings-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="listing-card listing-skeleton" key={index}>
            <div className="listing-visual skeleton-block" />
            <div className="listing-card-body">
              <div className="skeleton-line skeleton-badge" />
              <div className="skeleton-line skeleton-name" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-short" />
              <div className="skeleton-line" />
              <div className="listing-card-footer">
                <div className="skeleton-line skeleton-short" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
