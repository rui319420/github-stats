"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CARD_TITLE,
  DEFAULT_ANIMATION_INTERVAL_SECONDS,
  DEFAULT_CARD_SIZE,
  DEFAULT_BOUNDARY,
  DEFAULT_LANGUAGE_COUNT,
  DEFAULT_THEME,
  MAX_CARD_SIZE,
  MIN_CARD_SIZE,
  formatPercent,
  isBoundaryPosition,
  isCardThemeName,
  isLanguageCountOption,
  parseCardSize,
  type BoundaryPosition,
  type CardThemeName,
  type EmbedFormat,
  type LanguageCountOption,
} from "../lib/chartOptions";

interface LanguagePieChartProps {
  initialUsername?: string;
  isSignedIn?: boolean;
  privateCardError?: string;
  privateCardToken?: string;
}

interface LanguageOption {
  name: string;
  percentage: number;
}

interface LanguagesApiResponse {
  languages?: LanguageOption[];
  error?: string;
}

interface CardSearchParamsOptions {
  boundary: BoundaryPosition;
  count: LanguageCountOption;
  githubColors: boolean;
  hiddenLanguages: string;
  includeCardToken?: boolean;
  includePrivate: boolean;
  privateCardToken?: string;
  cardSize: number;
  showBorder: boolean;
  theme: CardThemeName;
  transparentBackground: boolean;
  username: string;
}

function parseHiddenLanguagesInput(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeHiddenLanguages(languages: string[]): string {
  return languages.join(", ");
}

function applyCardSearchParams(
  params: URLSearchParams,
  options: CardSearchParamsOptions
) {
  const username = options.username.trim();
  if (username) {
    params.set("username", username);
  } else {
    params.delete("username");
  }

  if (options.includePrivate) {
    params.set("include_private", "true");
    if (options.includeCardToken && options.privateCardToken) {
      params.set("card_token", options.privateCardToken);
    } else {
      params.delete("card_token");
    }
  } else {
    params.delete("include_private");
    params.delete("card_token");
  }

  params.set("count", options.count);
  if (options.hiddenLanguages.trim()) {
    params.set("hide", options.hiddenLanguages.trim());
  } else {
    params.delete("hide");
  }
  params.set("theme", options.theme);
  params.set("boundary", options.boundary);
  params.set("size", String(options.cardSize));
  params.delete("layout");
  params.set("animated", "true");
  params.set("interval", String(DEFAULT_ANIMATION_INTERVAL_SECONDS));

  if (options.transparentBackground) {
    params.set("transparent", "true");
  } else {
    params.delete("transparent");
  }
  if (options.showBorder) {
    params.delete("border");
  } else {
    params.set("border", "false");
  }
  if (options.githubColors) {
    params.delete("github_colors");
  } else {
    params.set("github_colors", "false");
  }
}

export default function LanguagePieChart({
  initialUsername = "",
  isSignedIn = false,
  privateCardError,
  privateCardToken,
}: LanguagePieChartProps) {
  const [mounted, setMounted] = useState(false);
  const [origin, setOrigin] = useState("");
  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [activeUsername, setActiveUsername] = useState(initialUsername);
  const [includePrivate, setIncludePrivate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [embedFormat, setEmbedFormat] = useState<EmbedFormat>("markdown");
  const [languageCount, setLanguageCount] =
    useState<LanguageCountOption>(DEFAULT_LANGUAGE_COUNT);
  const [hiddenLanguages, setHiddenLanguages] = useState("");
  const [theme, setTheme] = useState<CardThemeName>(DEFAULT_THEME);
  const [boundary, setBoundary] = useState<BoundaryPosition>(DEFAULT_BOUNDARY);
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [showBorder, setShowBorder] = useState(true);
  const [githubColors, setGithubColors] = useState(true);
  const [cardSize, setCardSize] = useState(DEFAULT_CARD_SIZE);
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([]);
  const [languageOptionsLoading, setLanguageOptionsLoading] = useState(false);
  const [languageOptionsError, setLanguageOptionsError] = useState<string | null>(null);

  const selectedHiddenLanguages = useMemo(
    () => parseHiddenLanguagesInput(hiddenLanguages),
    [hiddenLanguages]
  );

  const selectedHiddenLanguageSet = useMemo(
    () => new Set(selectedHiddenLanguages.map((language) => language.toLowerCase())),
    [selectedHiddenLanguages]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMounted(true);
      setOrigin(window.location.origin);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const buildImageUrl = useCallback((username: string, privateScope: boolean) => {
    if (!origin) return "";
    const params = new URLSearchParams();
    applyCardSearchParams(params, {
      boundary,
      cardSize,
      count: languageCount,
      githubColors,
      hiddenLanguages,
      includeCardToken: true,
      includePrivate: privateScope,
      privateCardToken,
      showBorder,
      theme,
      transparentBackground,
      username,
    });
    return `${origin}/api/languages.svg?${params.toString()}`;
  }, [
    boundary,
    cardSize,
    githubColors,
    hiddenLanguages,
    languageCount,
    origin,
    privateCardToken,
    showBorder,
    theme,
    transparentBackground,
  ]);

  const imageUrl = useMemo(
    () => buildImageUrl(activeUsername || usernameInput, includePrivate),
    [activeUsername, buildImageUrl, includePrivate, usernameInput]
  );

  const embedCode = useMemo(() => {
    if (!imageUrl || !origin) return "";
    if (embedFormat === "html") {
      return `<img src="${imageUrl}" alt="GitHub Language Stats" />`;
    }
    return `[![GitHub Language Stats](${imageUrl})](${origin})`;
  }, [embedFormat, imageUrl, origin]);

  const loadLanguageOptions = useCallback(async (
    username: string,
    privateScope: boolean
  ) => {
    const trimmed = username.trim();
    if (!trimmed) {
      setLanguageOptions([]);
      setLanguageOptionsError(null);
      return;
    }

    setLanguageOptionsLoading(true);
    setLanguageOptionsError(null);
    try {
      const params = new URLSearchParams({
        count: "all",
        username: trimmed,
      });
      if (privateScope) {
        params.set("include_private", "true");
        if (privateCardToken) params.set("card_token", privateCardToken);
      }
      params.set("t", String(Date.now()));

      const response = await fetch(`/api/languages?${params.toString()}`);
      const payload = (await response.json()) as LanguagesApiResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Language options fetch failed.");
      }
      setLanguageOptions(payload.languages ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Language options fetch failed.";
      setLanguageOptions([]);
      setLanguageOptionsError(message);
    } finally {
      setLanguageOptionsLoading(false);
    }
  }, [privateCardToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const initialUsernameFromUrl = params.get("username")?.trim() ?? "";
      const initialPrivate = params.get("include_private") === "true";
      const initialCount = params.get("count");
      const initialTheme = params.get("theme");
      const initialBoundary = params.get("boundary");
      const initialCardSize = params.get("size");
      const resolvedUsername = initialUsernameFromUrl || initialUsername;
      const resolvedCount = isLanguageCountOption(initialCount)
        ? initialCount
        : DEFAULT_LANGUAGE_COUNT;
      const resolvedHiddenLanguages = params.get("hide") ?? "";
      setUsernameInput(resolvedUsername);
      setActiveUsername(resolvedUsername);
      setIncludePrivate(initialPrivate);
      setLanguageCount(resolvedCount);
      setHiddenLanguages(resolvedHiddenLanguages);
      if (isCardThemeName(initialTheme)) {
        setTheme(initialTheme);
      }
      if (isBoundaryPosition(initialBoundary)) {
        setBoundary(initialBoundary);
      }
      setTransparentBackground(params.get("transparent") === "true");
      setShowBorder(params.get("border") !== "false");
      setGithubColors(params.get("github_colors") !== "false");
      setCardSize(parseCardSize(initialCardSize));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialUsername]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLanguageOptions(activeUsername, includePrivate);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeUsername, includePrivate, loadLanguageOptions]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = usernameInput.trim();
    const url = new URL(window.location.href);
    applyCardSearchParams(url.searchParams, {
      boundary,
      cardSize,
      count: languageCount,
      githubColors,
      hiddenLanguages,
      includePrivate,
      privateCardToken,
      showBorder,
      theme,
      transparentBackground,
      username: trimmed,
    });
    window.history.replaceState({}, "", url);
    setActiveUsername(trimmed);
    setCopied(false);
  };

  const copyEmbedCode = async () => {
    if (!embedCode) return;
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
  };

  const updateCardSize = (value: string | number) => {
    setCardSize(parseCardSize(value));
    setCopied(false);
  };

  const toggleHiddenLanguage = (language: string, hidden: boolean) => {
    const nextLanguages = hidden
      ? [...selectedHiddenLanguages, language]
      : selectedHiddenLanguages.filter(
          (selectedLanguage) =>
            selectedLanguage.toLowerCase() !== language.toLowerCase()
        );
    setHiddenLanguages(serializeHiddenLanguages(nextLanguages));
    setCopied(false);
  };

  return (
    <div className="flex w-full flex-col rounded-lg border border-[#2ea043]/40 bg-[#0d1117] p-4 shadow-[0_0_20px_rgba(46,160,67,0.15)] md:p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-wider text-[#F2F3F5]">{CARD_TITLE}</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={handleSubmit}>
          <input
            value={usernameInput}
            onChange={(event) => setUsernameInput(event.target.value)}
            placeholder="GitHub username"
            className="h-10 rounded-md border border-[#30363d] bg-[#161b22] px-3 text-sm text-[#F2F3F5] outline-none transition focus:border-[#2ea043] md:col-span-2"
          />
          <button
            type="submit"
            className="h-10 rounded-md bg-[#238636] px-5 text-sm font-semibold text-white transition hover:bg-[#2ea043]"
          >
            Load
          </button>
          <label className="flex items-center gap-2 text-sm text-[#c9d1d9] md:col-span-3">
            <input
              type="checkbox"
              checked={includePrivate}
              onChange={(event) => setIncludePrivate(event.target.checked)}
              className="h-4 w-4 accent-[#2ea043]"
            />
            Include private repositories
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#8b949e]">
            Languages
            <select
              value={languageCount}
              onChange={(event) => {
                const nextCount = event.target.value as LanguageCountOption;
                const nextUsername = usernameInput.trim() || activeUsername;
                const url = new URL(window.location.href);
                applyCardSearchParams(url.searchParams, {
                  boundary,
                  cardSize,
                  count: nextCount,
                  githubColors,
                  hiddenLanguages,
                  includePrivate,
                  privateCardToken,
                  showBorder,
                  theme,
                  transparentBackground,
                  username: nextUsername,
                });
                window.history.replaceState({}, "", url);
                setActiveUsername(nextUsername);
                setLanguageCount(nextCount);
                setCopied(false);
              }}
              className="h-10 rounded-md border border-[#30363d] bg-[#161b22] px-3 text-sm font-normal normal-case text-[#F2F3F5] outline-none transition focus:border-[#2ea043]"
            >
              <option value="5">Top 5</option>
              <option value="8">Top 8</option>
              <option value="10">Top 10</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#8b949e]">
            Theme
            <select
              value={theme}
              onChange={(event) => {
                setTheme(event.target.value as CardThemeName);
                setCopied(false);
              }}
              className="h-10 rounded-md border border-[#30363d] bg-[#161b22] px-3 text-sm font-normal normal-case text-[#F2F3F5] outline-none transition focus:border-[#2ea043]"
            >
              <option value="github-dark">GitHub dark</option>
              <option value="github-light">GitHub light</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="transparent">Transparent</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-wide text-[#8b949e]">
            Boundary
            <select
              value={boundary}
              onChange={(event) => {
                setBoundary(event.target.value as BoundaryPosition);
                setCopied(false);
              }}
              className="h-10 rounded-md border border-[#30363d] bg-[#161b22] px-3 text-sm font-normal normal-case text-[#F2F3F5] outline-none transition focus:border-[#2ea043]"
            >
              <option value="top">Top</option>
              <option value="right">Right</option>
              <option value="bottom">Bottom</option>
              <option value="left">Left</option>
            </select>
          </label>
          <label className="grid gap-2 text-xs font-semibold uppercase tracking-wide text-[#8b949e] md:col-span-3">
            Size
            <div className="grid gap-3 md:grid-cols-[1fr_120px] md:items-center">
              <input
                type="range"
                min={MIN_CARD_SIZE}
                max={MAX_CARD_SIZE}
                step="20"
                value={cardSize}
                onChange={(event) => updateCardSize(event.target.value)}
                className="h-10 accent-[#2ea043]"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={MIN_CARD_SIZE}
                  max={MAX_CARD_SIZE}
                  step="20"
                  value={cardSize}
                  onChange={(event) => updateCardSize(event.target.value)}
                  className="h-10 w-full rounded-md border border-[#30363d] bg-[#161b22] px-3 text-sm font-normal normal-case text-[#F2F3F5] outline-none transition focus:border-[#2ea043]"
                />
                <span className="text-sm font-normal normal-case text-[#8b949e]">px</span>
              </div>
            </div>
          </label>
          <div className="grid gap-2 md:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#8b949e]">
                Hide languages
              </span>
              {selectedHiddenLanguages.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setHiddenLanguages("");
                    setCopied(false);
                  }}
                  className="text-xs font-semibold text-[#58a6ff] transition hover:text-[#79c0ff]"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="max-h-44 overflow-y-auto rounded-md border border-[#30363d] bg-[#161b22] p-3">
              {languageOptionsLoading ? (
                <p className="text-sm text-[#8b949e]">Loading languages...</p>
              ) : languageOptionsError ? (
                <p className="text-sm text-[#f85149]">{languageOptionsError}</p>
              ) : languageOptions.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {languageOptions.map((language) => {
                    const checked = selectedHiddenLanguageSet.has(
                      language.name.toLowerCase()
                    );
                    return (
                      <label
                        key={language.name}
                        className="flex min-w-0 items-center justify-between gap-3 rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#c9d1d9]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              toggleHiddenLanguage(
                                language.name,
                                event.target.checked
                              )
                            }
                            className="h-4 w-4 shrink-0 accent-[#2ea043]"
                          />
                          <span className="truncate">{language.name}</span>
                        </span>
                        <span className="shrink-0 text-xs text-[#8b949e]">
                          {formatPercent(language.percentage)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-[#8b949e]">
                  Load a GitHub username to choose languages.
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-2 text-sm text-[#c9d1d9] md:col-span-3 md:grid-cols-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={transparentBackground}
                onChange={(event) => {
                  setTransparentBackground(event.target.checked);
                  setCopied(false);
                }}
                className="h-4 w-4 accent-[#2ea043]"
              />
              Transparent background
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={githubColors}
                onChange={(event) => {
                  setGithubColors(event.target.checked);
                  setCopied(false);
                }}
                className="h-4 w-4 accent-[#2ea043]"
              />
              GitHub language colors
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showBorder}
                onChange={(event) => {
                  setShowBorder(event.target.checked);
                  setCopied(false);
                }}
                className="h-4 w-4 accent-[#2ea043]"
              />
              Border
            </label>
          </div>
        </form>
        {includePrivate && !isSignedIn && !privateCardToken ? (
          <p className="mt-2 text-xs text-[#f0b72f]">
            Sign in with GitHub to generate a private repository card URL.
          </p>
        ) : null}
        {includePrivate && privateCardError ? (
          <p className="mt-2 text-xs text-[#f85149]">{privateCardError}</p>
        ) : null}
      </div>

      <div className="border-t border-[#30363d] pt-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#8b949e]">
          Preview
        </h3>
        <div className="overflow-x-auto rounded-md border border-[#30363d] bg-[#010409] p-3">
          {!mounted ? (
            <div className="flex h-32 items-center justify-center text-sm text-[#636e7b]">
              Loading...
            </div>
          ) : imageUrl ? (
            <object
              key={imageUrl}
              data={imageUrl}
              type="image/svg+xml"
              aria-label="GitHub Language Stats preview"
              className="max-w-none"
              style={{ height: cardSize, width: cardSize }}
            >
              GitHub Language Stats preview
            </object>
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-[#636e7b]">
              No preview
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 border-t border-[#30363d] pt-4">
        <div className="mb-3 inline-flex rounded-md border border-[#30363d] bg-[#161b22] p-1">
          <button
            type="button"
            onClick={() => {
              setEmbedFormat("markdown");
              setCopied(false);
            }}
            className={`h-8 rounded px-3 text-sm font-semibold transition ${
              embedFormat === "markdown"
                ? "bg-[#238636] text-white"
                : "text-[#8b949e] hover:text-[#f0f6fc]"
            }`}
          >
            Markdown
          </button>
          <button
            type="button"
            onClick={() => {
              setEmbedFormat("html");
              setCopied(false);
            }}
            className={`h-8 rounded px-3 text-sm font-semibold transition ${
              embedFormat === "html"
                ? "bg-[#238636] text-white"
                : "text-[#8b949e] hover:text-[#f0f6fc]"
            }`}
          >
            HTML img
          </button>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            readOnly
            value={embedCode}
            className="h-10 flex-1 rounded-md border border-[#30363d] bg-[#161b22] px-3 font-mono text-xs text-[#c9d1d9] outline-none"
          />
          <button
            type="button"
            onClick={copyEmbedCode}
            disabled={!embedCode}
            className="h-10 rounded-md border border-[#3d444d] px-4 text-sm font-semibold text-[#f0f6fc] transition hover:border-[#8b949e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
