// In-memory label sink for spec 004. Spec 005 replaces it with the Downloads folder.
import type { LabelFile, LabelSink } from "../core/queue.ts";

export interface StoredLabel extends LabelFile {
  file: string;
}

export interface MemorySink extends LabelSink {
  /** Labels by job id, in the order they were saved. */
  readonly labels: ReadonlyMap<string, StoredLabel>;
}

export function labelFileName(orderId: string, number: string): string {
  const clean = (value: string): string => value.replace(/[^A-Za-z0-9._-]+/g, "_");
  return `${clean(orderId)}_${clean(number)}.pdf`;
}

export function createMemorySink(): MemorySink {
  const labels = new Map<string, StoredLabel>();
  return {
    labels,
    async save(job, label) {
      const file = labelFileName(
        job.shipment.orderId,
        job.trackingNumber ?? job.shipmentNumber ?? "label",
      );
      labels.set(job.id, { ...label, file });
      return { file };
    },
  };
}
