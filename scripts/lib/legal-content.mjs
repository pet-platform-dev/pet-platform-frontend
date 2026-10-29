import { createHash } from "node:crypto";

// Build-time lapa-legal-v1 contract; cross-repo checks verify backend parity.
export function canonicalLegalJson(value) {
  if (typeof value === "string")
    return JSON.stringify(value.replace(/\r\n?/g, "\n").normalize("NFC"));
  if (value === null || typeof value === "boolean" || typeof value === "number")
    return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map(canonicalLegalJson).join(",")}]`;
  if (typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(
        ([key, item]) => `${JSON.stringify(key)}:${canonicalLegalJson(item)}`,
      )
      .join(",")}}`;
  throw new Error("Unsupported legal content value");
}
export function legalContentDigest(document) {
  return createHash("sha256")
    .update(
      canonicalLegalJson({ contract: "lapa-legal-v1", ...document }),
      "utf8",
    )
    .digest("hex");
}
