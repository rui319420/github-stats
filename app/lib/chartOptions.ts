export type CardThemeName =
  | "dark"
  | "light"
  | "transparent"
  | "github-dark"
  | "github-light";

export type BoundaryPosition = "top" | "right" | "bottom" | "left";
export type EmbedFormat = "markdown" | "html";
export type LanguageCountOption = "5" | "8" | "10" | "all";

export interface CardTheme {
  background: string;
  border: string;
  foreground: string;
  muted: string;
}

export const CARD_TITLE = "Most Used Languages";
export const DEFAULT_LANGUAGE_COUNT: LanguageCountOption = "8";
export const DEFAULT_THEME: CardThemeName = "github-dark";
export const DEFAULT_BOUNDARY: BoundaryPosition = "top";
export const DEFAULT_ANIMATION_INTERVAL_SECONDS = 2;

export const FALLBACK_LANGUAGE_PALETTE = [
  "#58a6ff",
  "#3fb950",
  "#f2cc60",
  "#ff7b72",
  "#bc8cff",
  "#39c5cf",
  "#ffa657",
  "#d2a8ff",
  "#7ee787",
  "#a5d6ff",
];

export const CARD_THEMES: Record<CardThemeName, CardTheme> = {
  dark: {
    background: "#111827",
    border: "#374151",
    foreground: "#f9fafb",
    muted: "#9ca3af",
  },
  light: {
    background: "#ffffff",
    border: "#d0d7de",
    foreground: "#24292f",
    muted: "#57606a",
  },
  transparent: {
    background: "transparent",
    border: "#30363d",
    foreground: "#f0f6fc",
    muted: "#8b949e",
  },
  "github-dark": {
    background: "#0d1117",
    border: "#30363d",
    foreground: "#f0f6fc",
    muted: "#8b949e",
  },
  "github-light": {
    background: "#ffffff",
    border: "#d0d7de",
    foreground: "#24292f",
    muted: "#57606a",
  },
};

export const SVG_BOUNDARY_ANGLES: Record<BoundaryPosition, number> = {
  top: -90,
  right: 0,
  bottom: 90,
  left: 180,
};

export const RECHARTS_BOUNDARY_ANGLES: Record<BoundaryPosition, number> = {
  top: 90,
  right: 0,
  bottom: 270,
  left: 180,
};

export function isCardThemeName(value: string | null): value is CardThemeName {
  return (
    value === "dark" ||
    value === "light" ||
    value === "transparent" ||
    value === "github-dark" ||
    value === "github-light"
  );
}

export function isBoundaryPosition(value: string | null): value is BoundaryPosition {
  return (
    value === "top" ||
    value === "right" ||
    value === "bottom" ||
    value === "left"
  );
}

export function isLanguageCountOption(
  value: string | null
): value is LanguageCountOption {
  return value === "5" || value === "8" || value === "10" || value === "all";
}

export function parseTheme(value: string | null): CardThemeName {
  return isCardThemeName(value) ? value : DEFAULT_THEME;
}

export function parseBoundary(value: string | null): BoundaryPosition {
  return isBoundaryPosition(value) ? value : DEFAULT_BOUNDARY;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`;
}

export function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function truncateLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}
