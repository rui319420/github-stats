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
  assert.deepEqual(createCardLayout({ ...stats, languages: [] }, options), { height: 390, contentOffsetY: 0, slices: [] });
});

test("the Other bucket keeps a neutral color for both language palettes", () => {
  const stats = { username: "alice", includePrivate: false, repositoryCount: 1,
    languages: [{ name: "Other", bytes: 100, percentage: 1 }] };
  for (const githubColors of [true, false]) {
    const options = { ...parseCardOptions(new URLSearchParams()), githubColors };
    assert.equal(createCardLayout(stats, options).slices[0].color, "#8b949e");
  }
});

test("hidden header rows compact short, empty, and long cards without clipping content", () => {
  for (const count of [0, 1, 10, 72]) {
    const stats = { username: "alice", includePrivate: false, repositoryCount: 1,
      languages: Array.from({ length: count }, (_, index) => ({ name: `Language ${index}`, bytes: 1, percentage: 1 / count })) };
    const defaults = parseCardOptions(new URLSearchParams());
    const fullHeight = createCardLayout(stats, defaults).height;
    for (const showTitle of [true, false]) {
      for (const showUsername of [true, false]) {
        for (const boundary of ["top", "right", "bottom", "left"] as const) {
          const layout = createCardLayout(stats, { ...defaults, showTitle, showUsername, boundary });
          const savedSpace = (showTitle ? 0 : 20) + (showUsername ? 0 : 20);
          assert.equal(layout.height, fullHeight - savedSpace);
          assert.equal(layout.contentOffsetY, savedSpace ? -savedSpace : 0);
          for (const slice of layout.slices) {
            assert.ok(slice.callout.textY + layout.contentOffsetY - 14 > 1);
            assert.ok(slice.callout.textY + layout.contentOffsetY + 18 < layout.height - 1);
            const legendBottom = 313 + Math.floor(slice.index / 2) * 24 + 7 + layout.contentOffsetY;
            assert.ok(legendBottom < layout.height - 1);
          }
        }
      }
    }
  }
});
