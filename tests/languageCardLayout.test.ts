import assert from "node:assert/strict";
import { test } from "node:test";
import { createCardLayout } from "../app/lib/languageCardLayout";
import { parseCardOptions } from "../app/lib/renderLanguageCard";

test("callouts stay inside the card for every angle and boundary", () => {
  for (const boundary of ["top", "right", "bottom", "left"]) {
    const stats = { username: "alice", includePrivate: false, repositoryCount: 1,
      languages: Array.from({ length: 72 }, (_, index) => ({ name: `Language ${index}`, bytes: 1, percentage: 1 / 72 })) };
    const layout = createCardLayout(stats, parseCardOptions(new URLSearchParams({ boundary })));
    assert.equal(layout.slices.length, 72);
    for (const slice of layout.slices) {
      assert.ok(slice.callout.textX >= 70 && slice.callout.textX <= 350);
      assert.ok(slice.callout.textY >= 70 && slice.callout.textY + 18 < 300);
      assert.ok(["start", "end"].includes(slice.callout.anchor));
      assert.doesNotMatch(slice.path + slice.highlightPath + slice.callout.path, /NaN|Infinity/);
    }
    assert.ok(layout.height > 420);
  }
});

test("single language and empty charts produce stable finite layouts", () => {
  const options = parseCardOptions(new URLSearchParams());
  const stats = { username: "alice", includePrivate: false, repositoryCount: 1, languages: [{ name: "TypeScript", bytes: 1, percentage: 1 }] };
  const layout = createCardLayout(stats, options);
  assert.equal(layout.slices[0].color, "#3178c6");
  assert.doesNotMatch(layout.slices[0].path, /NaN|Infinity/);
  assert.deepEqual(createCardLayout({ ...stats, languages: [] }, options), { height: 390, slices: [] });
});
