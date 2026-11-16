import { CARD_THEMES, clamp, truncateLabel } from "./chartOptions";
import { cardThemeStyles, languageTextColor } from "./cardTheme";
import { FORTY_TWO_ACCENT, type FortyTwoProjectStatus, type FortyTwoStats } from "./fortyTwoStats";
import { escapeXml, parseCardOptions, type CardOptions } from "./renderLanguageCard";

export const FORTY_TWO_CARD_TITLE = "42 Profile";
const DEFAULT_SKILL_COUNT = 5;
const DEFAULT_PROJECT_COUNT = 4;
const ROW_HEIGHT = 22;

export interface FortyTwoCardOptions extends CardOptions {
  projectCount: number;
  skillCount: number;
}

const STATUS_LABELS: Record<FortyTwoProjectStatus, string> = {
  in_progress: "進行中",
  waiting_for_correction: "評価待ち",
  forming_team: "チーム編成中",
};

function parseCount(value: string | null, fallback: number, max: number) {
  const count = value?.trim() ? Number(value) : NaN;
  return Number.isInteger(count) ? clamp(count, 0, max) : fallback;
}

export function parseFortyTwoCardOptions(params: URLSearchParams): FortyTwoCardOptions {
  return {
    ...parseCardOptions(params),
    projectCount: parseCount(params.get("projects"), DEFAULT_PROJECT_COUNT, 8),
    skillCount: parseCount(params.get("skills"), DEFAULT_SKILL_COUNT, 10),
  };
}

// 42 levels are "integer level + fraction towards the next one" (5.42 = 42%).
export function levelProgress(level: number) {
  const whole = Math.floor(level);
  // Guard against 5.9999 rendering as "100%" of level 5.
  return { whole, percent: Math.min(99, Math.round((level - whole) * 100)) };
}

function barStyles(options: FortyTwoCardOptions) {
  if (!options.animated) return "";
  return `<style>
    .bar { transform-box: fill-box; transform-origin: left center; animation: bar-grow .9s ease-out backwards; }
    @keyframes bar-grow { from { transform: scaleX(0); } }
    @media (prefers-reduced-motion: reduce) { .bar { animation: none; } }
  </style>`;
}

export function renderFortyTwoSvg(stats: FortyTwoStats, options: FortyTwoCardOptions) {
  const theme = CARD_THEMES[options.theme];
  const accent = stats.coalition?.color ?? FORTY_TWO_ACCENT;
  // Fills keep the coalition color; text is adjusted for contrast per theme.
  const accentText = languageTextColor(accent, options.theme, 0);
  const { whole, percent } = levelProgress(stats.level);
  const parts: string[] = [];
  let y = 28 + (options.showTitle ? 20 : 0) + (options.showUsername ? 20 : 0);

  // Level
  parts.push(`<text x="28" y="${y + 30}" fill="${theme.foreground}" font-size="30" font-weight="700" class="numeric"><tspan fill="${theme.muted}" font-size="13" font-weight="400">Lv. </tspan>${whole}</text>
    <text x="392" y="${y + 30}" text-anchor="end" fill="${theme.muted}" font-size="12" class="numeric">${percent}% → Lv. ${whole + 1}</text>
    <rect x="28" y="${y + 42}" width="364" height="10" rx="5" fill="${theme.border}"/>
    ${percent > 0 ? `<rect class="bar" x="28" y="${y + 42}" width="${(Math.max(10, 364 * percent / 100)).toFixed(1)}" height="10" rx="5" fill="${accent}"/>` : ""}`);
  y += 52;

  // Totals
  const totals: Array<[string, string]> = [["完了した課題", String(stats.completedProjects)]];
  if (stats.grade) totals.push(["グレード", truncateLabel(stats.grade, 18)]);
  parts.push(totals.map(([label, value], index) => {
    const x = 28 + index * 196;
    return `<text x="${x}" y="${y + 28}" fill="${theme.muted}" font-size="11">${label}</text>
    <text x="${x}" y="${y + 50}" fill="${theme.foreground}" font-size="17" font-weight="700" class="${index === 0 ? "numeric" : ""}">${escapeXml(value)}</text>`;
  }).join(""));
  y += 50;

  // Current projects
  if (options.projectCount > 0) {
    const shown = stats.currentProjects.slice(0, options.projectCount);
    const hidden = stats.currentProjects.length - shown.length;
    parts.push(`<text x="28" y="${y + 32}" fill="${theme.muted}" font-size="11" font-weight="700">取り組み中の課題</text>`);
    y += 32;
    if (!shown.length) {
      parts.push(`<text x="28" y="${y + ROW_HEIGHT}" fill="${theme.muted}" font-size="12">現在取り組み中の課題はありません</text>`);
      y += ROW_HEIGHT;
    }
    for (const project of shown) {
      y += ROW_HEIGHT;
      parts.push(`<circle cx="32" cy="${y - 4}" r="4" fill="${accent}"/>
    <text x="44" y="${y}" fill="${theme.foreground}" font-size="13" font-weight="600">${escapeXml(truncateLabel(project.name, 30))}</text>
    <text x="392" y="${y}" text-anchor="end" fill="${project.status === "in_progress" ? theme.muted : accentText}" font-size="11">${STATUS_LABELS[project.status]}</text>`);
    }
    if (hidden > 0) {
      y += 18;
      parts.push(`<text x="44" y="${y}" fill="${theme.muted}" font-size="11">ほか ${hidden} 件</text>`);
    }
  }

  // Skills
  const skills = stats.skills.slice(0, options.skillCount);
  if (skills.length) {
    // Bars compare skills with each other; the exact level is printed beside each.
    const scale = Math.max(1, Math.ceil(skills[0].level));
    parts.push(`<text x="28" y="${y + 32}" fill="${theme.muted}" font-size="11" font-weight="700">スキル</text>`);
    y += 32;
    for (const skill of skills) {
      y += ROW_HEIGHT;
      const width = 140 * Math.min(1, skill.level / scale);
      parts.push(`<g><title>${escapeXml(skill.name)}: ${skill.level.toFixed(2)}</title>
    <text x="28" y="${y}" fill="${theme.foreground}" font-size="11">${escapeXml(truncateLabel(skill.name, 27))}</text>
    <rect x="204" y="${y - 9}" width="140" height="8" rx="4" fill="${theme.border}"/>
    ${width > 0 ? `<rect class="bar" x="204" y="${y - 9}" width="${Math.max(8, width).toFixed(1)}" height="8" rx="4" fill="${accent}"/>` : ""}
    <text x="392" y="${y}" text-anchor="end" fill="${theme.muted}" font-size="11" class="numeric">${skill.level.toFixed(2)}</text></g>`);
    }
  }

  const height = y + 26;
  const subtitle = [`@${stats.login}`, stats.campus ? `42 ${stats.campus}` : null].filter(Boolean).join(" · ");
  const description = [
    `レベル ${stats.level.toFixed(2)}`,
    `完了した課題 ${stats.completedProjects} 件`,
    stats.currentProjects.length ? `取り組み中: ${stats.currentProjects.map((project) => project.name).join("、")}` : null,
    stats.coalition ? `コアリション ${stats.coalition.name}` : null,
  ].filter(Boolean).join("。");
  const coalition = stats.coalition
    ? `<text x="392" y="35" text-anchor="end" fill="${accentText}" font-size="12" font-weight="700">${escapeXml(truncateLabel(stats.coalition.name, 22))}</text>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${options.size}" height="${Math.round(options.size * height / 420)}" viewBox="0 0 420 ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="card-title card-description" data-card-theme="${options.theme}">
  <title id="card-title">${options.showUsername ? `${escapeXml(stats.login)} — ` : ""}${FORTY_TWO_CARD_TITLE}</title>
  <desc id="card-description">${escapeXml(description)}。</desc>
  <style>text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', sans-serif; } .numeric { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-variant-numeric: tabular-nums; }</style>
  ${barStyles(options)}
  <style>${cardThemeStyles(options.theme, [accent])}</style>
  <rect x="1" y="1" width="418" height="${height - 2}" rx="18" fill="${options.transparent ? "none" : theme.background}" stroke="${options.border ? theme.border : "none"}"/>
  ${options.showTitle ? `<text x="28" y="35" fill="${theme.foreground}" font-size="17" font-weight="700">${FORTY_TWO_CARD_TITLE}</text>` : ""}
  ${options.showUsername ? `<text x="28" y="${options.showTitle ? 55 : 35}" fill="${theme.muted}" font-size="12">${escapeXml(truncateLabel(subtitle, 44))}</text>` : ""}
  ${coalition}
  ${parts.join("\n  ")}
</svg>`;
}
