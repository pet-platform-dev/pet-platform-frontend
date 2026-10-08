import { ListingUnavailable } from "@/widgets/listing-details/listing-detail-state";
export default function ListingNotFound() {
  return (
    <main className="listing-detail-shell">
      <ListingUnavailable />
    </main>
  );
}
