import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCardOptions, renderErrorSvg, renderStatsSvg, type CardOptions } from "../app/lib/renderLanguageCard";
import type { LanguageStats } from "../app/lib/githubLanguages";

const baseOptions: CardOptions = {
  animated: true,
  border: true,
  boundary: "top",
  githubColors: true,
  interval: 2,
  size: 420,
  theme: "github-dark",
  transparent: false,
};

function statsFrom(entries: Array<[string, number]>, username = "alice"): LanguageStats {
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  return {
    username,
    includePrivate: false,
    repositoryCount: entries.length,
    languages: entries.map(([name, bytes]) => ({
      name,
      bytes,
      percentage: total === 0 ? 0 : bytes / total,
    })),
  };
}

test("parseCardOptions reads and clamps SVG query parameters", () => {
  const options = parseCardOptions(
    new URLSearchParams({
      animated: "false",
      border: "false",
      boundary: "left",
      github_colors: "false",
      interval: "99",
      size: "800",
      theme: "light",
      transparent: "true",
    })
  );

  assert.deepEqual(options, {
    animated: false,
    border: false,
    boundary: "left",
    githubColors: false,
    interval: 10,
    size: 720,
    theme: "light",
    transparent: true,
  });
});

test("parseCardOptions supplies safe defaults for omitted values", () => {
  assert.deepEqual(parseCardOptions(new URLSearchParams()), baseOptions);
});

test("renderStatsSvg escapes user data and grows for a long legend", () => {
  const entries: Array<[string, number]> = Array.from(
    { length: 10 },
    (_, index) => [`Language ${index} &`, 100 - index]
  );
  const svg = renderStatsSvg(statsFrom(entries, "<alice&>"), baseOptions);

  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.match(svg, /<svg width="420" height="454" viewBox="0 0 420 454"/);
  assert.match(svg, /使用言語/);
  assert.match(svg, /&lt;alice&amp;&gt;/);
  assert.match(svg, /Language 0 &amp;/);
  assert.match(svg, /active-language-9/);
  assert.match(svg, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(svg, /<script[ >]/);
});

test("renderStatsSvg exposes a Japanese empty-data state", () => {
  const svg = renderStatsSvg(statsFrom([]), baseOptions);

  assert.match(svg, /まだ言語データがありません/);
  assert.match(svg, /対象や非表示設定を確認してください/);
  assert.match(svg, /viewBox="0 0 420 420"/);
});

test("renderErrorSvg localizes and escapes safe error output", () => {
  const svg = renderErrorSvg("<script>alert(1)</script>");

  assert.match(svg, /読み込みエラー/);
  assert.match(svg, /カードを読み込めませんでした/);
  assert.match(svg, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(svg, /<script>alert/);
});

test("active language uses a colored center label, outer highlight, and bounded callout", () => {
  const stats = { username: "alice", includePrivate: false, repositoryCount: 1, languages: [
    { name: "A very long language name", bytes: Number.MAX_SAFE_INTEGER, percentage: 1 },
  ] };
  const svg = renderStatsSvg(stats, parseCardOptions(new URLSearchParams("animated=false")));
  assert.match(svg, /stroke-width="2"/);
  assert.match(svg, /textLength="70" lengthAdjust="spacingAndGlyphs"/);
  assert.match(svg, /textLength="108" lengthAdjust="spacingAndGlyphs"/);
  assert.match(svg, /100.0%/);
  assert.doesNotMatch(svg, /NaN|Infinity|<script/);
});

test("SVG animation has a one-second initial delay and respects reduced motion", () => {
  const stats = { username: "alice", includePrivate: false, repositoryCount: 1, languages: [
    { name: "TypeScript", bytes: 60, percentage: .6 },
    { name: "Python", bytes: 40, percentage: .4 },
  ] };
  const svg = renderStatsSvg(stats, parseCardOptions(new URLSearchParams()));
  assert.match(svg, /animation-delay: 1s/);
  assert.match(svg, /animation-duration: 4s/);
  assert.match(svg, /animation-fill-mode: backwards/);
  assert.match(svg, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(renderStatsSvg(stats, parseCardOptions(new URLSearchParams("animated=false"))), /@keyframes/);
});
