import {
  ownerPublication,
  type ModerationStatus,
} from "@/shared/lib/moderation";
export function PublicationState({
  row,
}: {
  row: {
    status: string;
    moderationStatus: ModerationStatus;
    moderationReason?: string | null;
  };
}) {
  const state = ownerPublication(row);
  return (
    <div className="publication-state">
      <span className={`listing-status status-${state.tone}`}>
        {state.label}
      </span>
      {["REJECTED", "HIDDEN"].includes(row.moderationStatus) &&
        row.moderationReason && (
          <div className="publication-reason">
            <strong>Причина модерації</strong>
            <p>{row.moderationReason}</p>
          </div>
        )}
      {state.helper && <p className="form-hint">{state.helper}</p>}
    </div>
  );
}
