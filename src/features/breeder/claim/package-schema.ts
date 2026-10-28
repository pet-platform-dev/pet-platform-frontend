import { z } from "zod";
import { draftSchema } from "../handoff/contracts";
export const packageSchema = z.object({
  revision: z.string().regex(/^[0-9a-f]{64}$/),
  count: z.number().int().nonnegative(),
  canAccept: z.boolean(),
  blockers: z.array(
    z.object({ id: z.uuid(), title: z.string(), message: z.string() }),
  ),
  listings: z.array(draftSchema),
});
export type BreederPackage = z.infer<typeof packageSchema>;
