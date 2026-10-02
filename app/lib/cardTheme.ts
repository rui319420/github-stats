import { CARD_THEMES, type CardThemeName } from "./chartOptions";

function rgb(color: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
}

function luminance(channels: number[]) {
  const linear = channels.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

// Keep the hue while adjusting text to a contrast ratio of at least 4.5:1.
// The original GitHub colors still identify the donut slices and legend dots.
export function readableLanguageColor(color: string, background: string): string {
  const source = rgb(color);
  const backgroundLuminance = luminance(rgb(background));
  const target = backgroundLuminance > 0.179 ? 0 : 255;
  for (let step = 0; step <= 100; step++) {
    const channels = source.map((value) => Math.round(value + (target - value) * step / 100));
    const textLuminance = luminance(channels);
    const contrast = (Math.max(textLuminance, backgroundLuminance) + 0.05)
      / (Math.min(textLuminance, backgroundLuminance) + 0.05);
    if (contrast >= 4.5) {
      return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
    }
  }
  return target === 0 ? "#000000" : "#ffffff";
}

export function languageTextColor(color: string, theme: CardThemeName, index: number) {
  const background = theme === "auto" ? CARD_THEMES["github-light"].background
    : theme === "transparent" ? CARD_THEMES["github-dark"].background
    : CARD_THEMES[theme].background;
  const readable = readableLanguageColor(color, background);
  return theme === "auto" ? `var(--card-language-${index}, ${readable})` : readable;
}

export function cardThemeStyles(theme: CardThemeName, colors: string[] = []) {
  if (theme !== "auto") return "";
  function variables(mode: "github-light" | "github-dark") {
    const palette = CARD_THEMES[mode];
    return `--card-background: ${palette.background}; --card-border: ${palette.border};
      --card-foreground: ${palette.foreground}; --card-muted: ${palette.muted};
      --card-error: ${mode === "github-light" ? "#cf222e" : "#ff7b72"};
      ${colors.map((color, index) => `--card-language-${index}: ${readableLanguageColor(color, palette.background)};`).join("\n")}`;
  }
  return `svg[data-card-theme="auto"] { color-scheme: light dark; ${variables("github-light")} }
    @media (prefers-color-scheme: dark) {
      svg[data-card-theme="auto"] { ${variables("github-dark")} }
    }`;
}
