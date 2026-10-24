import Link from "next/link";
import type { z } from "zod";
import {
  userSchema,
  breederRowSchema,
  roleLabels,
  verificationLabels,
  sourceLabels,
} from "./model";
import {
  managedDetailHref,
  type ListState,
  type ManagementKind,
} from "./navigation";
export function ManagementListCards({
  rows,
  kind,
  state,
}: {
  rows: (z.infer<typeof userSchema> | z.infer<typeof breederRowSchema>)[];
  kind: ManagementKind;
  state: ListState;
}) {
  return (
    <div className="admin-management-grid">
      {rows.map((row) => (
        <article className="dashboard-card" key={row.id}>
          <h2>
            <Link
              prefetch={false}
              href={managedDetailHref(kind, row.id, state)}
            >
              {"email" in row
                ? [row.firstName, row.lastName].filter(Boolean).join(" ")
                : row.kennelName || "Чернетка без назви"}
            </Link>
          </h2>
          {"email" in row ? (
            <>
              <p>{row.email}</p>
              <p>
                {roleLabels[row.role]} ·{" "}
                {verificationLabels[row.verificationStatus]}
              </p>
            </>
          ) : (
            <>
              <p>{sourceLabels[row.source]}</p>
              <p>
                {row.visibility === "PUBLIC"
                  ? "Публічний профіль власника"
                  : "Приватний запис"}
                {row.source === "OPERATOR_PREPARED"
                  ? " · Згоду зафіксовано"
                  : ""}
              </p>
            </>
          )}
          <p className="muted">
            Створено:{" "}
            {new Intl.DateTimeFormat("uk-UA", {
              dateStyle: "short",
              timeZone: "Europe/Kyiv",
            }).format(new Date(row.createdAt))}
          </p>
        </article>
      ))}
    </div>
  );
}
