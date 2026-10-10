export function BreederProfileSkeleton() {
  return (
    <section
      className="seller-profile profile-skeleton"
      role="status"
      aria-label="Завантажуємо профіль"
    >
      <div className="listing-detail-panel" aria-hidden="true">
        <div className="skeleton-block profile-skeleton-title" />
        <div className="skeleton-block profile-skeleton-line" />
        <div className="skeleton-block profile-skeleton-line" />
      </div>
      <div className="listing-detail-panel" aria-hidden="true">
        <div className="skeleton-block profile-skeleton-title" />
        <div className="skeleton-block profile-skeleton-line" />
      </div>
      <span className="sr-only">Завантажуємо профіль…</span>
    </section>
  );
}
