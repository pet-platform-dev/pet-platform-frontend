import { ListingUnavailable } from "@/widgets/listing-details/listing-detail-state";
export default function MatingNotFound() {
  return (
    <main className="listing-detail-shell mating-detail">
      <ListingUnavailable
        catalogHref="/mating"
        catalogLabel="До оголошень про в’язку"
      />
    </main>
  );
}
