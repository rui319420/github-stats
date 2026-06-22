"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CARD_TITLE,
  DEFAULT_ANIMATION_INTERVAL_SECONDS,
  DEFAULT_CARD_SIZE,
  DEFAULT_BOUNDARY,
  DEFAULT_LANGUAGE_COUNT,
  DEFAULT_THEME,
  formatPercent,
  isBoundaryPosition,
  isCardThemeName,
  isLanguageCountOption,
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
  params.set("size", String(DEFAULT_CARD_SIZE));
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
    <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
      <section className="rounded-[28px] border border-[#e8eaed] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.12),0_1px_3px_rgba(60,64,67,0.08)] sm:p-6">
        <div className="mb-6 flex flex-col gap-2">
          <p className="text-sm font-medium text-[#1a73e8]">Card settings</p>
          <h2 className="text-2xl font-semibold tracking-tight text-[#202124]">{CARD_TITLE}</h2>
          <p className="max-w-2xl text-sm leading-6 text-[#5f6368]">
            Tune the data source, appearance, and embed format from one compact control panel.
          </p>
        </div>

        <form className="grid gap-5 md:grid-cols-3" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-medium text-[#3c4043] md:col-span-2">
            GitHub username
            <input
              value={usernameInput}
              onChange={(event) => setUsernameInput(event.target.value)}
              placeholder="GitHub username"
              className="h-12 rounded-full border border-[#dadce0] bg-white px-5 text-sm text-[#202124] outline-none transition-colors duration-200 placeholder:text-[#80868b] hover:border-[#bdc1c6] focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/15"
            />
          </label>
          <button
            type="submit"
            className="h-12 cursor-pointer self-end rounded-full bg-[#1a73e8] px-6 text-sm font-medium text-white shadow-[0_1px_2px_rgba(26,115,232,0.24)] transition-colors duration-200 hover:bg-[#1765cc] focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/30"
          >
            Load
          </button>
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-[#f8fafd] px-4 py-3 text-sm font-medium text-[#3c4043] md:col-span-3">
            <input
              type="checkbox"
              checked={includePrivate}
              onChange={(event) => setIncludePrivate(event.target.checked)}
              className="h-4 w-4 accent-[#1a73e8]"
            />
            Include private repositories
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#3c4043]">
            Languages
            <select
              value={languageCount}
              onChange={(event) => {
                const nextCount = event.target.value as LanguageCountOption;
                const nextUsername = usernameInput.trim() || activeUsername;
                const url = new URL(window.location.href);
                applyCardSearchParams(url.searchParams, {
                  boundary,
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
              className="h-11 rounded-xl border border-[#dadce0] bg-white px-4 text-sm font-normal text-[#202124] outline-none transition-colors duration-200 hover:border-[#bdc1c6] focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/15"
            >
              <option value="5">Top 5</option>
              <option value="8">Top 8</option>
              <option value="10">Top 10</option>
              <option value="all">All</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#3c4043]">
            Theme
            <select
              value={theme}
              onChange={(event) => {
                setTheme(event.target.value as CardThemeName);
                setCopied(false);
              }}
              className="h-11 rounded-xl border border-[#dadce0] bg-white px-4 text-sm font-normal text-[#202124] outline-none transition-colors duration-200 hover:border-[#bdc1c6] focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/15"
            >
              <option value="github-dark">GitHub dark</option>
              <option value="github-light">GitHub light</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="transparent">Transparent</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#3c4043]">
            Boundary
            <select
              value={boundary}
              onChange={(event) => {
                setBoundary(event.target.value as BoundaryPosition);
                setCopied(false);
              }}
              className="h-11 rounded-xl border border-[#dadce0] bg-white px-4 text-sm font-normal text-[#202124] outline-none transition-colors duration-200 hover:border-[#bdc1c6] focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/15"
            >
              <option value="top">Top</option>
              <option value="right">Right</option>
              <option value="bottom">Bottom</option>
              <option value="left">Left</option>
            </select>
          </label>
          <div className="grid gap-2 md:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[#3c4043]">
                Hide languages
              </span>
              {selectedHiddenLanguages.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setHiddenLanguages("");
                    setCopied(false);
                  }}
                  className="cursor-pointer rounded-full px-3 py-1 text-sm font-medium text-[#1a73e8] transition-colors duration-200 hover:bg-[#e8f0fe]"
                >
                  Clear
                </button>
              ) : null}
          </div>
            <div className="max-h-52 overflow-y-auto rounded-2xl border border-[#e8eaed] bg-[#f8fafd] p-3">
              {languageOptionsLoading ? (
                <p className="text-sm text-[#5f6368]">Loading languages...</p>
              ) : languageOptionsError ? (
                <p className="text-sm text-[#d93025]">{languageOptionsError}</p>
              ) : languageOptions.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {languageOptions.map((language) => {
                    const checked = selectedHiddenLanguageSet.has(
                      language.name.toLowerCase()
                    );
                    return (
                      <label
                        key={language.name}
                        className="flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-full border border-[#e8eaed] bg-white px-3 py-2 text-sm text-[#3c4043] transition-colors duration-200 hover:border-[#d2e3fc] hover:bg-[#f8fbff]"
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
                            className="h-4 w-4 shrink-0 accent-[#1a73e8]"
                          />
                          <span className="truncate">{language.name}</span>
                        </span>
                        <span className="shrink-0 text-xs text-[#5f6368]">
                          {formatPercent(language.percentage)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-[#5f6368]">
                  Load a GitHub username to choose languages.
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-3 text-sm font-medium text-[#3c4043] md:col-span-3 md:grid-cols-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#e8eaed] px-4 py-3 transition-colors duration-200 hover:bg-[#f8fafd]">
              <input
                type="checkbox"
                checked={transparentBackground}
                onChange={(event) => {
                  setTransparentBackground(event.target.checked);
                  setCopied(false);
                }}
                className="h-4 w-4 accent-[#1a73e8]"
              />
              Transparent background
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#e8eaed] px-4 py-3 transition-colors duration-200 hover:bg-[#f8fafd]">
              <input
                type="checkbox"
                checked={githubColors}
                onChange={(event) => {
                  setGithubColors(event.target.checked);
                  setCopied(false);
                }}
                className="h-4 w-4 accent-[#1a73e8]"
              />
              GitHub language colors
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#e8eaed] px-4 py-3 transition-colors duration-200 hover:bg-[#f8fafd]">
              <input
                type="checkbox"
                checked={showBorder}
                onChange={(event) => {
                  setShowBorder(event.target.checked);
                  setCopied(false);
                }}
                className="h-4 w-4 accent-[#1a73e8]"
              />
              Border
            </label>
          </div>
        </form>
        {includePrivate && !isSignedIn && !privateCardToken ? (
          <p className="mt-4 rounded-2xl bg-[#fef7e0] px-4 py-3 text-sm text-[#795548]">
            Sign in with GitHub to generate a private repository card URL.
          </p>
        ) : null}
        {includePrivate && privateCardError ? (
          <p className="mt-4 rounded-2xl bg-[#fce8e6] px-4 py-3 text-sm text-[#d93025]">{privateCardError}</p>
        ) : null}
      </section>

      <aside className="grid gap-6">
        <section className="rounded-[28px] border border-[#e8eaed] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.12),0_1px_3px_rgba(60,64,67,0.08)] sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold tracking-tight text-[#202124]">
              Preview
            </h3>
            <span className="rounded-full bg-[#e8f0fe] px-3 py-1 text-xs font-medium text-[#1967d2]">
              Live
            </span>
          </div>
          <div className="overflow-x-auto rounded-3xl border border-[#e8eaed] bg-[#f8fafd] p-4">
            {!mounted ? (
              <div className="flex h-32 items-center justify-center text-sm text-[#5f6368]">
                Loading...
              </div>
            ) : imageUrl ? (
              <object
                key={imageUrl}
                data={imageUrl}
                type="image/svg+xml"
                aria-label="GitHub Language Stats preview"
                className="max-w-none rounded-2xl"
                style={{ height: DEFAULT_CARD_SIZE, width: DEFAULT_CARD_SIZE }}
              >
                GitHub Language Stats preview
              </object>
            ) : (
              <div className="flex h-32 items-center justify-center text-sm text-[#5f6368]">
                No preview
              </div>
            )}
            </div>
        </section>

        <section className="rounded-[28px] border border-[#e8eaed] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.12),0_1px_3px_rgba(60,64,67,0.08)] sm:p-6">
          <div className="mb-4 inline-flex rounded-full bg-[#f1f3f4] p-1">
            <button
              type="button"
              onClick={() => {
                setEmbedFormat("markdown");
                setCopied(false);
              }}
              className={`h-9 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors duration-200 ${
                embedFormat === "markdown"
                  ? "bg-white text-[#1a73e8] shadow-[0_1px_2px_rgba(60,64,67,0.2)]"
                  : "text-[#5f6368] hover:text-[#202124]"
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
              className={`h-9 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors duration-200 ${
                embedFormat === "html"
                  ? "bg-white text-[#1a73e8] shadow-[0_1px_2px_rgba(60,64,67,0.2)]"
                  : "text-[#5f6368] hover:text-[#202124]"
              }`}
            >
              HTML img
            </button>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              readOnly
              value={embedCode}
              className="h-11 min-w-0 flex-1 rounded-full border border-[#dadce0] bg-white px-4 font-mono text-xs text-[#3c4043] outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/15"
            />
            <button
              type="button"
              onClick={copyEmbedCode}
              disabled={!embedCode}
              className="h-11 cursor-pointer rounded-full border border-[#dadce0] px-5 text-sm font-medium text-[#1a73e8] transition-colors duration-200 hover:bg-[#f8fafd] focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}
