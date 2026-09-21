"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  CARD_THEMES,
  CARD_TITLE,
  formatBytes,
  formatPercent,
  truncateLabel,
} from "../lib/chartOptions";
import { createCardLayout, type CardOptions } from "../lib/languageCardLayout";
import type { LanguageStats } from "../lib/languageStats";

interface Props {
  stats: LanguageStats;
  options: CardOptions;
}

export default function InteractiveLanguageCard({ stats, options }: Props) {
  const { height, slices } = createCardLayout(stats, options);
  const theme = CARD_THEMES[options.theme];
  const titleId = useId();
  const descriptionId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState({
    index: 0,
    delay: 1000 + options.interval * 1000,
  });
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  // Start with motion disabled until the browser's preference is known.
  const [reducedMotion, setReducedMotion] = useState(true);
  const paused = hovered !== null || focused !== null;
  const selectedIndex = Math.min(active.index, Math.max(0, slices.length - 1));
  const selected = slices[selectedIndex];
  const selectedName = selected
    ? truncateLabel(selected.language.name, 20)
    : "";
  const nameFontSize =
    selected && selected.language.name.length > 12
      ? 13
      : selected && selected.language.name.length > 8
        ? 18
        : 26;

  function stopTimer() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!options.animated || reducedMotion || paused || slices.length < 2)
      return;
    timer.current = setTimeout(() => {
      setActive({
        index: (selectedIndex + 1) % slices.length,
        delay: options.interval * 1000,
      });
    }, active.delay);
    return stopTimer;
  }, [
    active,
    selectedIndex,
    options.animated,
    options.interval,
    paused,
    reducedMotion,
    slices.length,
  ]);

  function select(index: number) {
    stopTimer();
    // Resume relative to the language the user just inspected, never from index zero.
    setActive({ index, delay: 100 + options.interval * 1000 });
  }

  function interactionProps(index: number) {
    return {
      role: "button" as const,
      tabIndex: 0,
      "aria-label": `${slices[index].language.name} ${formatPercent(slices[index].language.percentage)} ${formatBytes(slices[index].language.bytes)}`,
      "aria-pressed": index === selectedIndex,
      onPointerEnter: (event: React.PointerEvent<SVGGElement>) => {
        if (event.pointerType === "touch") return;
        setHovered(index);
        select(index);
      },
      onPointerLeave: (event: React.PointerEvent<SVGGElement>) => {
        if (event.pointerType === "touch") return;
        setHovered(null);
        if (focused !== null) select(focused);
      },
      // Pointer selection must not leave keyboard focus holding the loop paused.
      onPointerDown: (event: React.PointerEvent<SVGGElement>) => {
        event.preventDefault();
        event.currentTarget.ownerSVGElement
          ?.querySelector<SVGGElement>("g:focus")
          ?.blur();
        setFocused(null);
      },
      onClick: () => select(index),
      onFocus: () => {
        setFocused(index);
        select(index);
      },
      onBlur: () => {
        setFocused(null);
        if (hovered !== null) select(hovered);
      },
      onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select(index);
        }
      },
    };
  }

  return (
    <svg
      className="card-image interactive-card"
      width={options.size}
      height={Math.round((options.size * height) / 420)}
      viewBox={`0 0 420 ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="group"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-active-index={selectedIndex}
      data-paused={paused}
    >
      <title id={titleId}>{`${stats.username} の使用言語`}</title>
      <desc id={descriptionId}>
        言語の円弧や凡例にカーソルを合わせると表示を固定し、外すとそこから順番に再開します。Tabキーでも言語を選べます。
      </desc>
      <rect
        x="1"
        y="1"
        width="418"
        height={height - 2}
        rx="18"
        fill={
          options.transparent || options.theme === "transparent"
            ? "none"
            : theme.background
        }
        stroke={options.border ? theme.border : "none"}
      />
      <text
        x="28"
        y="35"
        fill={theme.foreground}
        fontSize="17"
        fontWeight="700"
      >
        {CARD_TITLE}
      </text>
      <text x="28" y="55" fill={theme.muted} fontSize="12">
        @{stats.username}
      </text>
      {slices.map((slice) => (
        <g
          key={slice.language.name}
          className="language-sector"
          data-language-index={slice.index}
          {...interactionProps(slice.index)}
        >
          <path d={slice.path} fill={slice.color} />
        </g>
      ))}
      {selected ? (
        <g className="language-active" pointerEvents="none" aria-hidden="true">
          <path d={selected.highlightPath} fill={selected.color} />
          <text
            className="active-language-name"
            x="210"
            y="191"
            textAnchor="middle"
            fill={selected.color}
            fontSize={nameFontSize}
            textLength={
              selectedName.length * nameFontSize * 0.6 > 108 ? 108 : undefined
            }
            lengthAdjust="spacingAndGlyphs"
            fontWeight="700"
          >
            {selectedName}
          </text>
          <path
            d={selected.callout.path}
            stroke={selected.color}
            strokeWidth="2"
          />
          <circle
            cx={selected.callout.x}
            cy={selected.callout.y}
            r="3"
            fill={selected.color}
          />
          <text
            x={selected.callout.textX}
            y={selected.callout.textY}
            textAnchor={selected.callout.anchor}
            fill={theme.foreground}
            fontSize="12"
            fontWeight="700"
            className="numeric"
          >
            {formatPercent(selected.language.percentage)}
          </text>
          <text
            x={selected.callout.textX}
            y={selected.callout.textY + 18}
            textAnchor={selected.callout.anchor}
            fill={theme.muted}
            fontSize="10"
            className="numeric"
            textLength={
              formatBytes(selected.language.bytes).length > 11 ? 70 : undefined
            }
            lengthAdjust="spacingAndGlyphs"
          >
            {formatBytes(selected.language.bytes)}
          </text>
        </g>
      ) : (
        <g>
          <circle
            cx="210"
            cy="183"
            r="72"
            stroke={theme.border}
            strokeWidth="24"
          />
          <text
            x="210"
            y="180"
            textAnchor="middle"
            fill={theme.foreground}
            fontSize="15"
          >
            まだ言語データがありません
          </text>
          <text
            x="210"
            y="203"
            textAnchor="middle"
            fill={theme.muted}
            fontSize="11"
          >
            対象や非表示設定を確認してください
          </text>
        </g>
      )}
      {slices.map((slice) => {
        const x = slice.index % 2 === 0 ? 30 : 224;
        const y = 313 + Math.floor(slice.index / 2) * 24;
        return (
          <g
            key={slice.language.name}
            className="language-legend"
            data-language-index={slice.index}
            {...interactionProps(slice.index)}
          >
            <rect
              x={x - 6}
              y={y - 17}
              width="182"
              height="24"
              rx="4"
              fill={slice.index === selectedIndex ? slice.color : "transparent"}
              fillOpacity={slice.index === selectedIndex ? 0.1 : 0}
            />
            <circle cx={x + 4} cy={y - 4} r="4" fill={slice.color} />
            <text x={x + 16} y={y} fill={theme.foreground} fontSize="11">
              {truncateLabel(slice.language.name, 15)}
            </text>
            <text
              x={x + 166}
              y={y}
              textAnchor="end"
              fill={theme.muted}
              fontSize="11"
              className="numeric"
            >
              {formatPercent(slice.language.percentage)}
            </text>
          </g>
        );
      })}
      <line
        x1="28"
        y1={height - 36}
        x2="392"
        y2={height - 36}
        stroke={theme.border}
      />
      <text x="28" y={height - 17} fill={theme.muted} fontSize="10">
        {stats.repositoryCount} リポジトリ ·{" "}
        {stats.includePrivate ? "公開＋非公開" : "公開リポジトリ"}
      </text>
      <text
        x="392"
        y={height - 17}
        textAnchor="end"
        fill={theme.muted}
        fontSize="10"
      >
        コード量 / bytes
      </text>
    </svg>
  );
}
