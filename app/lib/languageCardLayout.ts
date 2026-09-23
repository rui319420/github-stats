import {
  FALLBACK_LANGUAGE_PALETTE,
  SVG_BOUNDARY_ANGLES,
  clamp,
  type BoundaryPosition,
  type CardThemeName,
} from "./chartOptions";
import { GITHUB_LANGUAGE_COLORS, getRandomColor } from "./constants";
import type { LanguageData, LanguageStats } from "./languageStats";

export interface CardOptions {
  animated: boolean;
  border: boolean;
  boundary: BoundaryPosition;
  githubColors: boolean;
  interval: number;
  size: number;
  theme: CardThemeName;
  transparent: boolean;
}

export interface CardCallout {
  path: string;
  x: number;
  y: number;
  textX: number;
  textY: number;
  anchor: "start" | "end";
}

export interface CardLayoutSlice {
  language: LanguageData;
  index: number;
  color: string;
  path: string;
  highlightPath: string;
  callout: CardCallout;
}

export interface CardLayout {
  height: number;
  slices: CardLayoutSlice[];
}

const CARD_WIDTH = 420;
const CENTER_X = CARD_WIDTH / 2;
const CENTER_Y = 183;
const DONUT_INNER_RADIUS = 58;
const DONUT_OUTER_RADIUS = 82;
const HIGHLIGHT_INNER_RADIUS = DONUT_OUTER_RADIUS + 6;
const HIGHLIGHT_OUTER_RADIUS = DONUT_OUTER_RADIUS + 10;
const CALLOUT_BEND_RADIUS = 116;
const CALLOUT_ENDPOINT_X = 335;
const CALLOUT_MIN_Y = 85;
const CALLOUT_MAX_Y = 281;
const CALLOUT_TEXT_GAP_X = 6;
const CALLOUT_TEXT_OFFSET_Y = -6;

function fixed(value: number) {
  return value.toFixed(3);
}

function coordinates(radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return {
    x: CENTER_X + radius * Math.cos(radians),
    y: CENTER_Y + radius * Math.sin(radians),
  };
}

function point(radius: number, angle: number) {
  const { x, y } = coordinates(radius, angle);
  return `${fixed(x)} ${fixed(y)}`;
}

function segment(start: number, end: number, inner: number, outer: number) {
  // SVG arcs cannot draw a full circle with coincident endpoints.
  const span = Math.max(0, end - start);
  const adjustedEnd = span >= 359.999 ? start + 359.999 : end;
  const large = adjustedEnd - start > 180 ? 1 : 0;
  return `M ${point(outer, start)} A ${outer} ${outer} 0 ${large} 1 ${point(outer, adjustedEnd)} L ${point(inner, adjustedEnd)} A ${inner} ${inner} 0 ${large} 0 ${point(inner, start)} Z`;
}

function languageColor(name: string, index: number, githubColors: boolean) {
  if (name === "その他") return "#8b949e";
  return githubColors
    ? GITHUB_LANGUAGE_COLORS[name] ?? getRandomColor(name)
    : FALLBACK_LANGUAGE_PALETTE[index % FALLBACK_LANGUAGE_PALETTE.length];
}

function safePercentage(language: LanguageData) {
  return Number.isFinite(language.percentage) ? Math.max(0, language.percentage) : 0;
}

function callout(start: number, end: number): CardCallout {
  const angle = start + (end - start) / 2;
  const radians = angle * Math.PI / 180;
  const right = Math.cos(radians) >= 0;
  const startPoint = coordinates(HIGHLIGHT_OUTER_RADIUS, angle);
  const bendPoint = coordinates(CALLOUT_BEND_RADIUS, angle);
  const endpointX = right ? CALLOUT_ENDPOINT_X : CARD_WIDTH - CALLOUT_ENDPOINT_X;
  const endpointY = clamp(bendPoint.y, CALLOUT_MIN_Y, CALLOUT_MAX_Y);
  const textX = right ? endpointX + CALLOUT_TEXT_GAP_X : endpointX - CALLOUT_TEXT_GAP_X;
  const textY = endpointY + CALLOUT_TEXT_OFFSET_Y;
  const path = `M ${fixed(startPoint.x)} ${fixed(startPoint.y)} L ${fixed(bendPoint.x)} ${fixed(endpointY)} L ${fixed(endpointX)} ${fixed(endpointY)}`;

  return {
    path,
    x: Number(endpointX.toFixed(3)),
    y: Number(endpointY.toFixed(3)),
    textX: Number(textX.toFixed(3)),
    textY: Number(textY.toFixed(3)),
    anchor: right ? "start" : "end",
  };
}

export function createCardLayout(stats: LanguageStats, options: CardOptions): CardLayout {
  let angle = SVG_BOUNDARY_ANGLES[options.boundary];
  const slices = stats.languages.map((language, index) => {
    const start = angle;
    angle += safePercentage(language) * 360;
    return {
      language,
      index,
      color: languageColor(language.name, index, options.githubColors),
      path: segment(start, angle, DONUT_INNER_RADIUS, DONUT_OUTER_RADIUS),
      highlightPath: segment(start, angle, HIGHLIGHT_INNER_RADIUS, HIGHLIGHT_OUTER_RADIUS),
      callout: callout(start, angle),
    };
  });
  return { height: Math.max(390, 314 + Math.ceil(slices.length / 2) * 24), slices };
}
