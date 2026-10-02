import assert from "node:assert/strict";
import { test } from "node:test";
import { readableLanguageColor } from "../app/lib/cardTheme";
import { GITHUB_LANGUAGE_COLORS } from "../app/lib/constants";
import { CARD_THEMES, FALLBACK_LANGUAGE_PALETTE } from "../app/lib/chartOptions";

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test("language labels remain readable for all known colors on light and dark cards", () => {
  const colors = [...Object.values(GITHUB_LANGUAGE_COLORS), ...FALLBACK_LANGUAGE_PALETTE, "#8b949e", "#000000", "#ffffff"];
  for (const mode of ["light", "github-light", "dark", "github-dark"] as const) {
    const background = CARD_THEMES[mode].background;
    for (const color of colors) {
      const label = readableLanguageColor(color, background);
      assert.match(label, /^#[0-9a-f]{6}$/i);
      const values = [luminance(label), luminance(background)].sort((a, b) => b - a);
      assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${color} on ${mode}: ${label}`);
    }
  }
});

test("readable colors retain their original value", () => {
  assert.equal(readableLanguageColor("#24292f", "#ffffff"), "#24292f");
  assert.equal(readableLanguageColor("#f0f6fc", "#0d1117"), "#f0f6fc");
});
