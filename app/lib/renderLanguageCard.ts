import {
  CARD_THEMES,
  CARD_TITLE,
  DEFAULT_ANIMATION_INTERVAL_SECONDS,
  clamp,
  formatBytes,
  formatPercent,
  parseBoundary,
  parseCardSize,
  parseTheme,
  truncateLabel,
} from "./chartOptions";
import { createCardLayout, type CardOptions } from "./languageCardLayout";
export type { CardOptions } from "./languageCardLayout";
import { parseBooleanParam, type LanguageStats } from "./githubLanguages";

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]!);
}

function optionalBoolean(value: string | null, fallback: boolean) {
  return value === null ? fallback : parseBooleanParam(value);
}

export function parseCardOptions(params: URLSearchParams): CardOptions {
  const theme = parseTheme(params.get("theme"));
  const rawInterval = params.get("interval");
  const interval = rawInterval?.trim() ? Number(rawInterval) : NaN;
  return {
    animated: optionalBoolean(params.get("animated"), true),
    border: optionalBoolean(params.get("border"), true),
    boundary: parseBoundary(params.get("boundary")),
    githubColors: optionalBoolean(params.get("github_colors"), true),
    interval: Number.isFinite(interval) ? clamp(interval, 1, 10) : DEFAULT_ANIMATION_INTERVAL_SECONDS,
    size: parseCardSize(params.get("size")),
    theme,
    transparent: theme === "transparent" || parseBooleanParam(params.get("transparent")),
  };
}

function animationStyles(total: number, options: CardOptions) {
  if (total < 2 || !options.animated) return "";
  const duration = total * options.interval;
  const slice = 100 / total;
  return `<style>
    .active-language { opacity: 0; animation-delay: 1s; animation-fill-mode: backwards; animation-duration: ${duration}s; animation-iteration-count: infinite; animation-timing-function: steps(1, end); }
    ${Array.from({ length: total }, (_, i) => {
      const start = i * slice;
      const end = (i + 1) * slice;
      return `.active-language-${i} { animation-name: language-${i}; }
        @keyframes language-${i} {
          ${i === 0 ? "" : `0%, ${Math.max(0, start - 0.001).toFixed(4)}% { opacity: 0; }`}
          ${start.toFixed(4)}%, ${(end - 0.001).toFixed(4)}% { opacity: 1; }
          ${end.toFixed(4)}%, 100% { opacity: 0; }
        }`;
    }).join("\n")}
    @media (prefers-reduced-motion: reduce) {
      .active-language { animation: none; opacity: 0; }
      .active-language-0 { opacity: 1; }
    }
  </style>`;
}

export function renderStatsSvg(stats: LanguageStats, options: CardOptions) {
  const theme = CARD_THEMES[options.theme];
  const { height, slices } = createCardLayout(stats, options);
  const description = stats.languages.length
    ? stats.languages.map((language) => `${language.name} ${formatPercent(language.percentage)}`).join("、")
    : "集計できる言語データがありません。";
  const donut = slices.map(({ language, path, color }) =>
    `<path d="${path}" fill="${color}"><title>${escapeXml(language.name)}: ${formatPercent(language.percentage)}</title></path>`
  ).join("");
  const active = slices.map(({ language, index, highlightPath, color, callout }) => {
    const name = truncateLabel(language.name, 20);
    const fontSize = language.name.length > 12 ? 13 : language.name.length > 8 ? 18 : 26;
    const nameFit = name.length * fontSize * .6 > 108 ? ' textLength="108" lengthAdjust="spacingAndGlyphs"' : "";
    const bytes = formatBytes(language.bytes);
    const bytesFit = bytes.length > 11 ? ' textLength="70" lengthAdjust="spacingAndGlyphs"' : "";
    return `<g class="active-language active-language-${index}" opacity="${index === 0 ? 1 : 0}">
      <path d="${highlightPath}" fill="${color}"/>
      <text x="210" y="191" text-anchor="middle" fill="${color}" font-size="${fontSize}" font-weight="700"${nameFit}>${escapeXml(name)}</text>
      <path d="${callout.path}" stroke="${color}" stroke-width="2"/>
      <circle cx="${callout.x}" cy="${callout.y}" r="3" fill="${color}"/>
      <text x="${callout.textX}" y="${callout.textY}" text-anchor="${callout.anchor}" fill="${theme.foreground}" font-size="14" font-weight="800" class="numeric">${formatPercent(language.percentage)}</text>
      <text x="${callout.textX}" y="${callout.textY + 18}" text-anchor="${callout.anchor}" fill="${theme.muted}" font-size="10" class="numeric"${bytesFit}>${bytes}</text>
    </g>`;
  }).join("");
  const legend = slices.map(({ language, index, color }) => {
    const x = index % 2 === 0 ? 30 : 224;
    const y = 313 + Math.floor(index / 2) * 24;
    return `<g><title>${escapeXml(language.name)}: ${formatPercent(language.percentage)}</title>
      <circle cx="${x + 4}" cy="${y - 4}" r="4" fill="${color}"/>
      <text x="${x + 16}" y="${y}" fill="${theme.foreground}" font-size="11">${escapeXml(truncateLabel(language.name, 15))}</text>
      <text x="${x + 166}" y="${y}" text-anchor="end" fill="${theme.muted}" font-size="11" class="numeric">${formatPercent(language.percentage)}</text></g>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${options.size}" height="${Math.round(options.size * height / 420)}" viewBox="0 0 420 ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="card-title card-description">
  <title id="card-title">${escapeXml(stats.username)} の使用言語</title>
  <desc id="card-description">${escapeXml(description)}。所有リポジトリのコード量に基づく割合。フォーク・アーカイブを除外。</desc>
  <style>text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', sans-serif; } .numeric { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-variant-numeric: tabular-nums; }</style>
  ${animationStyles(slices.length, options)}
  <rect x="1" y="1" width="418" height="${height - 2}" rx="18" fill="${options.transparent ? "none" : theme.background}" stroke="${options.border ? theme.border : "none"}"/>
  <text x="28" y="35" fill="${theme.foreground}" font-size="17" font-weight="700">${CARD_TITLE}</text>
  <text x="392" y="35" text-anchor="end" fill="${theme.muted}" font-size="10" letter-spacing="1.5">GITHUB STATS</text>
  <text x="28" y="55" fill="${theme.muted}" font-size="12">@${escapeXml(stats.username)}</text>
  ${slices.length ? `${donut}${active}${legend}` : `<circle cx="210" cy="183" r="72" stroke="${theme.border}" stroke-width="24"/><text x="210" y="180" text-anchor="middle" fill="${theme.foreground}" font-size="15">まだ言語データがありません</text><text x="210" y="203" text-anchor="middle" fill="${theme.muted}" font-size="11">対象や非表示設定を確認してください</text>`}
</svg>`;
}

export function renderErrorSvg(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="420" height="180" viewBox="0 0 420 180" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="error-title error-description">
  <title id="error-title">GitHub Stats — 読み込みエラー</title>
  <desc id="error-description">${escapeXml(message)}</desc>
  <rect x="1" y="1" width="418" height="178" rx="18" fill="#0d1117" stroke="#30363d"/>
  <g font-family="sans-serif">
    <text x="24" y="44" fill="#f0f6fc" font-size="18" font-weight="700">GitHub Stats</text>
    <text x="24" y="80" fill="#ff7b72" font-size="14">カードを読み込めませんでした</text>
    <text x="24" y="110" fill="#c9d1d9" font-size="11">${escapeXml(truncateLabel(message, 32))}</text>
    <text x="24" y="145" fill="#8b949e" font-size="11">アプリで設定を確認し、もう一度お試しください。</text>
  </g>
</svg>`;
}
