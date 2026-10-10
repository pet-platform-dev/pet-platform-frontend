export function BreederProfileAbout({
  description,
}: {
  description: string | null;
}) {
  if (!description) return null;
  return (
    <section className="listing-detail-panel" aria-labelledby="breeder-about">
      <h2 id="breeder-about">Про розплідник</h2>
      <p className="listing-description-text">{description}</p>
    </section>
  );
}
