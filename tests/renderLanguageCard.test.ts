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
  showTitle: true,
  showUsername: true,
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
    showTitle: true,
    showUsername: true,
    theme: "light",
    transparent: true,
  });
});

test("parseCardOptions supplies safe defaults for omitted values", () => {
  assert.deepEqual(parseCardOptions(new URLSearchParams()), baseOptions);
});

test("card title and username visibility are independent for populated and empty cards", () => {
  for (const showTitle of [true, false]) {
    for (const showUsername of [true, false]) {
      const options = parseCardOptions(new URLSearchParams({
        show_title: String(showTitle),
        show_username: String(showUsername),
      }));
      for (const stats of [statsFrom([["TypeScript", 100]]), statsFrom([])]) {
        const svg = renderStatsSvg(stats, options);
        assert.equal(/<text[^>]*>Language Usage<\/text>/.test(svg), showTitle);
        assert.equal(/<text[^>]*>@alice<\/text>/.test(svg), showUsername);
        const hiddenHeight = (showTitle ? 0 : 20) + (showUsername ? 0 : 20);
        assert.ok(svg.includes(`viewBox="0 0 420 ${390 - hiddenHeight}"`));
        assert.ok(svg.includes(`transform="translate(0 ${hiddenHeight ? -hiddenHeight : 0})"`));
        if (!showUsername) assert.doesNotMatch(svg, /alice/);
        if (showUsername && !showTitle) assert.match(svg, /<text x="28" y="35"[^>]*>@alice<\/text>/);
      }
    }
  }
});

test("renderStatsSvg escapes user data and grows for a long legend", () => {
  const entries: Array<[string, number]> = Array.from(
    { length: 10 },
    (_, index) => [`Language ${index} &`, 100 - index]
  );
  const svg = renderStatsSvg(statsFrom(entries, "<alice&>"), baseOptions);

  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.match(svg, /<svg width="420" height="434" viewBox="0 0 420 434"/);
  assert.match(svg, /Language Usage/);
  assert.match(svg, /&lt;alice&amp;&gt;/);
  assert.match(svg, /Language 0 &amp;/);
  assert.match(svg, /active-language-9/);
  assert.match(svg, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(svg, />\d+ リポジトリ ·/);
  assert.doesNotMatch(svg, />コード量 \/ bytes</);
  assert.doesNotMatch(svg, /<script[ >]/);
});

test("renderStatsSvg exposes a Japanese empty-data state", () => {
  const svg = renderStatsSvg(statsFrom([]), baseOptions);

  assert.match(svg, /まだ言語データがありません/);
  assert.match(svg, /対象や非表示設定を確認してください/);
  assert.match(svg, /viewBox="0 0 420 390"/);
});

test("light cards use readable language labels while retaining GitHub chart colors", () => {
  const options = parseCardOptions(new URLSearchParams("theme=github-light"));
  const svg = renderStatsSvg(statsFrom([["JavaScript", 100]]), options);
  assert.match(svg, /fill="#ffffff" stroke="#d0d7de"/);
  assert.match(svg, /fill="#24292f"/);
  assert.match(svg, /fill="#57606a"/);
  assert.match(svg, /fill="#f1e05a"><title>JavaScript/);
  assert.doesNotMatch(svg, /text-anchor="middle" fill="#f1e05a"/);
});

test("automatic theme includes both palettes for populated, empty, and error cards", () => {
  const options = parseCardOptions(new URLSearchParams("theme=auto"));
  assert.equal(options.theme, "auto");
  for (const svg of [
    renderStatsSvg(statsFrom([["JavaScript", 100]]), options),
    renderStatsSvg(statsFrom([]), options),
    renderErrorSvg("エラー", options),
  ]) {
    assert.match(svg, /data-card-theme="auto"/);
    assert.match(svg, /@media \(prefers-color-scheme: dark\)/);
    assert.match(svg, /--card-background: #ffffff/);
    assert.match(svg, /--card-background: #0d1117/);
    assert.match(svg, /fill="var\(--card-foreground/);
  }
});

test("error cards respect light, transparent, border, and size options", () => {
  const light = renderErrorSvg("エラー", parseCardOptions(new URLSearchParams("theme=github-light")));
  assert.match(light, /fill="#ffffff" stroke="#d0d7de"/);
  assert.match(light, /fill="#cf222e"/);
  const transparent = renderErrorSvg("エラー", parseCardOptions(new URLSearchParams("theme=light&transparent=true&border=false&size=600")));
  assert.match(transparent, /<svg width="600" height="257"/);
  assert.match(transparent, /fill="none" stroke="none"/);
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
  assert.match(svg, /font-size="14" font-weight="800" class="numeric">100.0%/);
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
