import { type NextRequest } from "next/server";
import { auth } from "../../../auth";
import { readCardToken } from "../../lib/cardToken";
import { GITHUB_LANGUAGE_COLORS, getRandomColor } from "../../lib/constants";
import {
  customizeLanguageStats,
  getLanguageStats,
  parseBooleanParam,
  parseHiddenLanguages,
  parseLanguageCount,
  resolveUsername,
  type LanguageData,
  type LanguageStats,
} from "../../lib/githubLanguages";

type CardThemeName = "dark" | "light" | "transparent" | "github-dark" | "github-light";

interface CardTheme {
  background: string;
  border: string;
  foreground: string;
  muted: string;
}

interface CardOptions {
  animated: boolean;
  border: boolean;
  githubColors: boolean;
  interval: number;
  theme: CardThemeName;
  transparent: boolean;
}

const LANGUAGE_PALETTE = [
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

const THEMES: Record<CardThemeName, CardTheme> = {
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

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`;
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function truncateLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function parseTheme(value: string | null): CardThemeName {
  if (
    value === "dark" ||
    value === "light" ||
    value === "transparent" ||
    value === "github-dark" ||
    value === "github-light"
  ) {
    return value;
  }
  return "github-dark";
}

function parseOptionalBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  return parseBooleanParam(value);
}

function parseInterval(value: string | null): number {
  const interval = Number(value);
  if (!Number.isFinite(interval)) return 2;
  return Math.min(10, Math.max(1, interval));
}

function parseCardOptions(request: NextRequest): CardOptions {
  const theme = parseTheme(request.nextUrl.searchParams.get("theme"));
  return {
    animated: parseBooleanParam(request.nextUrl.searchParams.get("animated")),
    border: parseOptionalBoolean(request.nextUrl.searchParams.get("border"), true),
    githubColors: parseOptionalBoolean(
      request.nextUrl.searchParams.get("github_colors"),
      true
    ),
    interval: parseInterval(request.nextUrl.searchParams.get("interval")),
    theme,
    transparent:
      theme === "transparent" ||
      parseBooleanParam(request.nextUrl.searchParams.get("transparent")),
  };
}

function getLanguageColor(
  language: string,
  index: number,
  githubColors: boolean
): string {
  if (!githubColors) return LANGUAGE_PALETTE[index % LANGUAGE_PALETTE.length];
  return GITHUB_LANGUAGE_COLORS[language] ?? getRandomColor(language);
}

function getDimensions() {
  return { width: 420, height: 420 };
}

function renderShell(
  width: number,
  height: number,
  theme: CardTheme,
  options: CardOptions
) {
  const background = options.transparent ? "transparent" : theme.background;
  const border = options.border
    ? `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="15" stroke="${theme.border}" fill="none"/>`
    : "";
  return `
  <rect width="${width}" height="${height}" rx="16" fill="${background}"/>
  ${border}`;
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  const radian = (Math.PI / 180) * angle;
  return {
    x: cx + radius * Math.cos(radian),
    y: cy + radius * Math.sin(radian),
  };
}

function describeDonutSegment(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) {
  const fullCircle = endAngle - startAngle >= 359.99;
  const adjustedEndAngle = fullCircle ? endAngle - 0.01 : endAngle;
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, adjustedEndAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, adjustedEndAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, startAngle);
  const largeArcFlag = adjustedEndAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function formatKeyframePercent(value: number) {
  return `${Math.max(0, Math.min(100, value)).toFixed(3)}%`;
}

function renderInteractionStyles(total: number, interval: number, animated: boolean) {
  if (total <= 0) return "";

  const hoverRules = Array.from({ length: total }, (_, index) => `
    .language-segment-${index}:hover ~ .active-layer-group .active-language-${index} {
      opacity: 1 !important;
    }`).join("");

  if (total <= 1 || !animated) {
    return `
  <style>
    .active-language { opacity: 0; }
    .active-language-0 { opacity: 1; }
    .language-segment { cursor: pointer; }
    .language-segment:hover ~ .active-layer-group .active-language {
      opacity: 0 !important;
    }
    ${hoverRules}
  </style>`;
  }

  const duration = total * interval;
  const slice = 100 / total;
  const gap = 0.001;
  const keyframes = Array.from({ length: total }, (_, index) => {
    const start = index * slice;
    const end = (index + 1) * slice;
    const beforeStart = Math.max(0, start - gap);
    const afterEnd = Math.min(100, end + gap);

    if (index === 0) {
      return `
    @keyframes active-language-${index} {
      0%, ${formatKeyframePercent(end)} { opacity: 1; }
      ${formatKeyframePercent(afterEnd)}, 99.999% { opacity: 0; }
      100% { opacity: 1; }
    }`;
    }

    if (index === total - 1) {
      return `
    @keyframes active-language-${index} {
      0%, ${formatKeyframePercent(beforeStart)} { opacity: 0; }
      ${formatKeyframePercent(start)}, 100% { opacity: 1; }
    }`;
    }

    return `
    @keyframes active-language-${index} {
      0%, ${formatKeyframePercent(beforeStart)} { opacity: 0; }
      ${formatKeyframePercent(start)}, ${formatKeyframePercent(end)} { opacity: 1; }
      ${formatKeyframePercent(afterEnd)}, 100% { opacity: 0; }
    }`;
  }).join("");

  return `
  <style>
    .active-language { opacity: 0; }
    .active-language-0 { opacity: 1; }
    .language-segment { cursor: pointer; }
    .active-language {
      animation-duration: ${duration}s;
      animation-iteration-count: infinite;
      animation-timing-function: steps(1, end);
    }
    ${Array.from({ length: total }, (_, index) => `
    .active-language-${index} {
      animation-name: active-language-${index};
    }`).join("")}
    .language-segment:hover ~ .active-layer-group .active-language {
      animation-play-state: paused;
      opacity: 0 !important;
    }
    ${hoverRules}
    ${keyframes}
  </style>`;
}

function renderInteractionScript(total: number, interval: number, animated: boolean) {
  if (total <= 1 || !animated) return "";

  return `
  <script><![CDATA[
    (function () {
      var root = document.currentScript && document.currentScript.ownerSVGElement;
      if (!root) return;

      var layers = Array.prototype.slice.call(root.querySelectorAll(".active-language"));
      var segments = Array.prototype.slice.call(root.querySelectorAll(".language-segment"));
      var activeIndex = 0;
      var interval = ${interval};
      var resumeFrame = 0;

      function setVisible(index) {
        if (resumeFrame) {
          cancelAnimationFrame(resumeFrame);
          resumeFrame = 0;
        }
        activeIndex = index;
        layers.forEach(function (layer, layerIndex) {
          layer.style.animationPlayState = "paused";
          layer.style.opacity = layerIndex === index ? "1" : "0";
        });
      }

      function resumeFrom(index) {
        var offset = "-" + index * interval + "s";
        if (resumeFrame) {
          cancelAnimationFrame(resumeFrame);
        }
        layers.forEach(function (layer, layerIndex) {
          layer.style.animationName = "none";
          layer.style.animationDelay = offset;
          layer.style.animationPlayState = "running";
          layer.style.opacity = layerIndex === index ? "1" : "0";
        });

        resumeFrame = requestAnimationFrame(function () {
          resumeFrame = 0;
          layers.forEach(function (layer) {
            layer.style.animationName = "";
            layer.style.animationDelay = offset;
            layer.style.animationPlayState = "running";
            layer.style.opacity = "";
          });
        });
      }

      segments.forEach(function (segment, index) {
        segment.addEventListener("pointerenter", function () {
          setVisible(index);
        });
        segment.addEventListener("pointerleave", function () {
          resumeFrom(activeIndex);
        });
      });
    }());
  ]]></script>`;
}

function renderActiveLanguage(
  language: LanguageData,
  index: number,
  theme: CardTheme,
  options: CardOptions,
  startAngle: number,
  endAngle: number
) {
  const cx = 210;
  const cy = 210;
  const outerRadius = 122;
  const color = getLanguageColor(language.name, index, options.githubColors);
  const midAngle = startAngle + (endAngle - startAngle) / 2;
  const cos = Math.cos((Math.PI / 180) * midAngle);
  const sin = Math.sin((Math.PI / 180) * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const labelX = ex + (cos >= 0 ? 1 : -1) * 12;
  const textAnchor = cos >= 0 ? "start" : "end";

  return `
  <g class="active-language active-language-${index}">
    <path d="${describeDonutSegment(cx, cy, outerRadius + 6, outerRadius + 10, startAngle, endAngle)}" fill="${color}"/>
    <path d="M${sx.toFixed(2)},${sy.toFixed(2)}L${mx.toFixed(2)},${my.toFixed(2)}L${ex.toFixed(2)},${ey.toFixed(2)}" stroke="${color}" fill="none" stroke-width="2"/>
    <circle cx="${ex.toFixed(2)}" cy="${ey.toFixed(2)}" r="3" fill="${color}" stroke="none"/>
    <text x="${cx}" y="${cy + 8}" text-anchor="middle" fill="${color}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="26" font-weight="700">${escapeXml(truncateLabel(language.name, 14))}</text>
    <text x="${labelX.toFixed(2)}" y="${ey.toFixed(2)}" text-anchor="${textAnchor}" fill="${theme.foreground}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="16" font-weight="700">${formatPercent(language.percentage)}</text>
    <text x="${labelX.toFixed(2)}" y="${(ey + 18).toFixed(2)}" text-anchor="${textAnchor}" fill="${theme.muted}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="12">${formatBytes(language.bytes)}</text>
  </g>`;
}

function renderRechartsStylePie(
  languages: LanguageData[],
  theme: CardTheme,
  options: CardOptions
) {
  const cx = 210;
  const cy = 210;
  const innerRadius = 86;
  const outerRadius = 122;
  let currentAngle = -90;
  const slices = languages.map((language, index) => {
    const startAngle = currentAngle;
    const endAngle = currentAngle + language.percentage * 360;
    currentAngle = endAngle;
    return { endAngle, index, language, startAngle };
  });

  const segments = slices
    .map(({ endAngle, index, language, startAngle }) => {
      const color = getLanguageColor(language.name, index, options.githubColors);
      return `
  <path class="language-segment language-segment-${index}" d="${describeDonutSegment(cx, cy, innerRadius, outerRadius, startAngle, endAngle)}" fill="${color}"/>`;
    })
    .join("");
  const activeLayers = slices
    .map(({ endAngle, index, language, startAngle }) =>
      renderActiveLanguage(
        language,
        index,
        theme,
        options,
        startAngle,
        endAngle
      )
    )
    .join("");

  return `
  ${segments}
  <g class="active-layer-group">
    ${activeLayers}
  </g>`;
}

function renderNoData(theme: CardTheme) {
  return `<text x="210" y="214" fill="${theme.muted}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="16" text-anchor="middle">No language data available.</text>`;
}

function renderStatsSvg(stats: LanguageStats, options: CardOptions) {
  const theme = THEMES[options.theme];
  const { width, height } = getDimensions();
  const content =
    stats.languages.length === 0
      ? renderNoData(theme)
      : renderRechartsStylePie(stats.languages, theme, options);
  const interactionStyles = renderInteractionStyles(
    stats.languages.length,
    options.interval,
    options.animated
  );
  const interactionScript = renderInteractionScript(
    stats.languages.length,
    options.interval,
    options.animated
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(stats.username)} GitHub language stats">
  ${interactionStyles}
  ${renderShell(width, height, theme, options)}
  ${content}
  ${interactionScript}
</svg>`;
}

function renderErrorSvg(message: string) {
  const width = 760;
  const height = 180;
  const theme = THEMES["github-dark"];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="GitHub language stats error">
  ${renderShell(width, height, theme, {
    border: true,
    githubColors: true,
    animated: false,
    interval: 2,
    theme: "github-dark",
    transparent: false,
  })}
  <text x="32" y="58" fill="${theme.foreground}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="24" font-weight="700">GitHub Language Stats</text>
  <text x="32" y="98" fill="#f85149" font-family="Segoe UI, Ubuntu, sans-serif" font-size="16">${escapeXml(message)}</text>
</svg>`;
}

function svgResponse(svg: string, status = 200) {
  return new Response(svg, {
    status,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const cardToken = request.nextUrl.searchParams.get("card_token");
    const privatePayload = cardToken ? readCardToken(cardToken) : null;
    const username =
      privatePayload?.username ??
      resolveUsername(
        request.nextUrl.searchParams.get("username") ??
          session?.user?.login
      );
    if (!username) {
      return svgResponse(
        renderErrorSvg("A valid GitHub username is required."),
        400
      );
    }

    const includePrivate = parseBooleanParam(
      request.nextUrl.searchParams.get("include_private")
    );
    const token = privatePayload?.accessToken ?? session?.accessToken;
    const stats = await getLanguageStats(username, includePrivate, token);
    const customizedStats = customizeLanguageStats(stats, {
      count: parseLanguageCount(request.nextUrl.searchParams.get("count")),
      hideLanguages: parseHiddenLanguages(request.nextUrl.searchParams.get("hide")),
    });

    return svgResponse(renderStatsSvg(customizedStats, parseCardOptions(request)));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch GitHub language data.";
    return svgResponse(renderErrorSvg(message), 502);
  }
}
