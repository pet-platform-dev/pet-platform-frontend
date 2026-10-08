import { z } from "zod";
import { publicRequest } from "@/shared/api/client";
import { locationSchema } from "./model";
export async function getLocations() {
  return z
    .array(locationSchema)
    .parse(await publicRequest<unknown>("/locations"));
}
