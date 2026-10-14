// Carrier registry. The only place that imports every carrier.
import type { CarrierAdapter } from "./_contract/adapter.ts";
import { cyprusPost } from "./cyprus-post/adapter.ts";

export const carriers: readonly CarrierAdapter[] = [cyprusPost];

export function findCarrier(id: string): CarrierAdapter | undefined {
  return carriers.find((carrier) => carrier.info.id === id);
}
