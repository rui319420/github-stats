import assert from "node:assert/strict";
import { test } from "node:test";
import { withAggregationSlot } from "../app/lib/aggregationLimit";

test("aggregation concurrency is bounded and slots are released", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const active = Array.from({ length: 4 }, () => withAggregationSlot(() => pending));
  await assert.rejects(withAggregationSlot(async () => 1), { status: 429, retryAfter: 5 });
  release();
  await Promise.all(active);
  assert.equal(await withAggregationSlot(async () => 42), 42);
});

test("failed aggregations release their slot", async () => {
  for (let i = 0; i < 6; i++) {
    await assert.rejects(withAggregationSlot(async () => { throw new Error("failure"); }), /failure/);
  }
  assert.equal(await withAggregationSlot(async () => "ready"), "ready");
});
