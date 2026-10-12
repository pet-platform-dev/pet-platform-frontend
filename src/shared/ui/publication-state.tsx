import {
  ownerPublication,
  type ModerationStatus,
} from "@/shared/lib/moderation";
export function PublicationState({
  row,
}: {
  row: { status: string; moderationStatus: ModerationStatus };
}) {
  const state = ownerPublication(row);
  return (
    <div className="publication-state">
      <span className={`listing-status status-${state.tone}`}>
        {state.label}
      </span>
      {state.helper && <p className="form-hint">{state.helper}</p>}
    </div>
  );
}
