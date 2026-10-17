import assert from "node:assert/strict";
import { test } from "node:test";
import type { Job } from "../core/queue.ts";
import { createMemorySink, labelFileName } from "./memory-sink.ts";

test("the memory sink names the file after the order and tracking number and keeps the bytes", async () => {
  const sink = createMemorySink();
  const job = {
    id: "job-1",
    shipment: { orderId: "171-1000003-1000003" },
    trackingNumber: "RR123456789CY",
  } as Job;
  const result = await sink.save(job, {
    bytes: new Uint8Array([1, 2]),
    mimeType: "application/pdf",
  });
  assert.equal(result.file, "171-1000003-1000003_RR123456789CY.pdf");
  assert.equal(sink.labels.get("job-1")?.bytes.length, 2);
  assert.equal(labelFileName("a/b c", "x y"), "a_b_c_x_y.pdf");
});
