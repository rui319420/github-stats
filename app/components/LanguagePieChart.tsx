"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  DEFAULT_BOUNDARY,
  DEFAULT_LANGUAGE_COUNT,
  DEFAULT_THEME,
  isBoundaryPosition,
  isCardThemeName,
  isLanguageCountOption,
  formatPercent,
  type BoundaryPosition,
  type CardThemeName,
  type EmbedFormat,
  type LanguageCountOption,
} from "../lib/chartOptions";

import InteractiveLanguageCard from "./InteractiveLanguageCard";
import {
  customizeLanguageStats,
  type LanguageStats,
} from "../lib/languageStats";
import { SAMPLE_LANGUAGE_STATS } from "../lib/sampleLanguageStats";

interface Props {
  initialUsername?: string;
  isSignedIn?: boolean;
  oauthConfigured?: boolean;
  privateCardToken?: string;
  privateCardError?: string;
}

interface Scan {
  username: string;
  includePrivate: boolean;
  revision: number;
}
type Status = "idle" | "loading" | "ready" | "error";

const themes: [CardThemeName, string][] = [
  ["github-dark", "GitHub ダーク"],
  ["github-light", "GitHub ライト"],
  ["dark", "ミッドナイト"],
  ["light", "ホワイト"],
  ["transparent", "透明"],
];
const usernamePattern = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export default function LanguagePieChart({
  initialUsername = "",
  isSignedIn = false,
  oauthConfigured = false,
  privateCardToken,
  privateCardError,
}: Props) {
  const [origin, setOrigin] = useState("");
  const [input, setInput] = useState(initialUsername);
  const [includePrivate, setIncludePrivate] = useState(false);
  const [scan, setScan] = useState<Scan | null>(null);
  const [stats, setStats] = useState<LanguageStats | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<CardThemeName>(DEFAULT_THEME);
  const [count, setCount] = useState<LanguageCountOption>(
    DEFAULT_LANGUAGE_COUNT,
  );
  const [boundary, setBoundary] = useState<BoundaryPosition>(DEFAULT_BOUNDARY);
  const [hidden, setHidden] = useState<string[]>([]);
  const [border, setBorder] = useState(true);
  const [transparent, setTransparent] = useState(false);
  const [githubColors, setGithubColors] = useState(true);
  const [animated, setAnimated] = useState(true);
  const [format, setFormat] = useState<EmbedFormat>("markdown");
  const [imageState, setImageState] = useState({
    url: "",
    loaded: false,
    error: false,
  });
  const [copiedCode, setCopiedCode] = useState("");
  const [copyError, setCopyError] = useState("");
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const canUsePrivate = Boolean(
    isSignedIn && initialUsername && privateCardToken,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOrigin(window.location.origin);
      const url = new URL(window.location.href);
      const params = url.searchParams;
      // Card credentials belong in the shareable image URL, never in page history.
      if (params.has("card_token")) {
        params.delete("card_token");
        window.history.replaceState({}, "", url);
      }
      const selectedTheme = params.get("theme");
      const selectedCount = params.get("count");
      const selectedBoundary = params.get("boundary");
      if (isCardThemeName(selectedTheme)) setTheme(selectedTheme);
      if (isLanguageCountOption(selectedCount)) setCount(selectedCount);
      if (isBoundaryPosition(selectedBoundary)) setBoundary(selectedBoundary);
      setHidden(
        (params.get("hide") ?? "")
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
      );
      setBorder(params.get("border") !== "false");
      setAnimated(params.get("animated") !== "false");
      setGithubColors(params.get("github_colors") !== "false");
      setTransparent(params.get("transparent") === "true");
      const username = params.get("username")?.trim();
      const wantsPrivate = ["true", "1", "yes", "on"].includes(
        params.get("include_private")?.toLowerCase() ?? "",
      );
      if (
        wantsPrivate &&
        (!canUsePrivate ||
          (username &&
            username.toLowerCase() !== initialUsername.toLowerCase()))
      ) {
        setError(
          "非公開カードは、連携した本人のユーザー名で作成してください。",
        );
        setStatus("error");
        return;
      }
      if (username && usernamePattern.test(username)) {
        setInput(username);
        setIncludePrivate(wantsPrivate);
        setStatus("loading");
        setScan({ username, includePrivate: wantsPrivate, revision: 0 });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canUsePrivate, initialUsername]);

  useEffect(() => {
    if (!scan) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      username: scan.username,
      count: "all",
    });
    if (scan.includePrivate) params.set("include_private", "true");
    // The same-origin JSON preview uses the session; only the image embed needs a card token.
    async function load() {
      try {
        const response = await fetch(`/api/languages?${params}`, {
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            payload.error ?? "言語データを取得できませんでした。",
          );
        if (!Array.isArray(payload.languages))
          throw new Error("言語データを確認できませんでした。");
        if (!controller.signal.aborted) {
          setStats(payload);
          setStatus("ready");
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        setStats(null);
        setStatus("error");
        setError(
          cause instanceof Error &&
            !(cause instanceof TypeError) &&
            !(cause instanceof SyntaxError)
            ? cause.message
            : "通信に失敗しました。接続を確認して再試行してください。",
        );
      }
    }
    void load();
    return () => controller.abort();
  }, [scan]);

  const imageUrl = useMemo(() => {
    if (!scan || status !== "ready" || !origin) return "";
    const params = new URLSearchParams({
      username: scan.username,
      count,
      theme,
      boundary,
      size: "420",
      border: String(border),
      animated: String(animated),
      interval: "2",
      github_colors: String(githubColors),
    });
    if (hidden.length) params.set("hide", hidden.join(","));
    if (transparent) params.set("transparent", "true");
    if (scan.includePrivate && privateCardToken) {
      params.set("include_private", "true");
      params.set("card_token", privateCardToken);
    }
    return `${origin}/api/languages.svg?${params}`;
  }, [
    scan,
    status,
    origin,
    count,
    theme,
    boundary,
    border,
    animated,
    githubColors,
    hidden,
    transparent,
    privateCardToken,
  ]);

  useEffect(() => {
    if (!imageUrl) return;
    const params = new URL(imageUrl).searchParams;
    params.delete("card_token");
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params}${window.location.hash}`,
    );
  }, [imageUrl]);

  const previewStats = customizeLanguageStats(stats ?? SAMPLE_LANGUAGE_STATS, {
    count: count === "all" ? "all" : (Number(count) as 5 | 8 | 10),
    hideLanguages: hidden,
  });
  const previewKey = `${scan?.username ?? "sample"}:${scan?.revision ?? 0}:${previewStats.languages.map((language) => `${language.name}:${language.bytes}`).join(",")}`;

  const hiddenNames = new Set(hidden.map((name) => name.toLowerCase()));
  const hasLanguages = Boolean(
    stats?.languages.some(
      (language) => !hiddenNames.has(language.name.toLowerCase()),
    ),
  );
  const imageReady = imageState.url === imageUrl && imageState.loaded;
  const imageFailed = imageState.url === imageUrl && imageState.error;
  const canExport = Boolean(imageUrl && imageReady && hasLanguages);
  const embedCode = !canExport
    ? ""
    : format === "html"
      ? `<img src="${imageUrl.replaceAll("&", "&amp;")}" alt="${scan?.username} の GitHub 使用言語" />`
      : `[![${scan?.username} の GitHub 使用言語](${imageUrl})](${origin})`;
  const localOrigin =
    origin &&
    (new URL(origin).protocol !== "https:" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = includePrivate ? initialUsername : input.trim();
    if (!usernamePattern.test(username)) {
      setStats(null);
      setScan(null);
      setError("GitHub ユーザー名を半角英数字とハイフンで入力してください。");
      setStatus("error");
      return;
    }
    if (includePrivate && !canUsePrivate) return;
    setStats(null);
    setError("");
    setCopyError("");
    setStatus("loading");
    setScan({ username, includePrivate, revision: Date.now() });
  }

  async function copyCode() {
    if (!embedCode) return;
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopiedCode(embedCode);
      setCopyError("");
    } catch {
      codeRef.current?.focus();
      codeRef.current?.select();
      setCopyError(
        "自動コピーできませんでした。選択されたコードを手動でコピーしてください。",
      );
    }
  }

  function changeScope(checked: boolean) {
    setIncludePrivate(checked);
    if (checked) setInput(initialUsername);
    setScan(null);
    setStats(null);
    setStatus("idle");
    setError("");
  }

  return (
    <div className="builder-grid">
      <section className="panel settings-panel" aria-labelledby="builder-title">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">01 / CUSTOMIZE</span>
            <h2 id="builder-title">自分のカードを作る</h2>
          </div>
          <span className="small-muted">公開カードはログイン不要</span>
        </div>
        <form onSubmit={submit} className="builder-form">
          <div className="field">
            <label htmlFor="username">GitHub ユーザー名</label>
            <div className="username-row">
              <div className="username-input">
                <span aria-hidden="true">@</span>
                <input
                  id="username"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="octocat"
                  maxLength={39}
                  required
                  readOnly={includePrivate}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="username-help"
                />
              </div>
              <button
                className="button primary"
                type="submit"
                disabled={status === "loading"}
              >
                {status === "loading" ? "集計中…" : "カードを作成"}
              </button>
            </div>
            <p className="field-help" id="username-help">
              所有するリポジトリの言語を、コード量で集計します。
            </p>
          </div>
          <div className="private-option">
            <label className="check-row">
              <input
                type="checkbox"
                checked={includePrivate}
                disabled={!canUsePrivate}
                onChange={(event) => changeScope(event.target.checked)}
              />
              <span>
                非公開リポジトリを含める<span className="badge">任意</span>
              </span>
            </label>
            <p className="field-help">
              {canUsePrivate ? (
                "連携した本人のリポジトリを集計します。公開してよい場合に選択してください。"
              ) : oauthConfigured ? (
                <>
                  <a href="#privacy">GitHub と連携</a>すると選択できます。
                </>
              ) : (
                "管理者が GitHub 連携を設定すると利用できます。"
              )}
            </p>
            {privateCardError && (
              <p className="error-text" role="alert">
                {privateCardError}
              </p>
            )}
            {includePrivate && (
              <p className="privacy-note">
                共有URLを知る人は、言語・コード量・割合・リポジトリ数を閲覧できます。リポジトリ名やソースコードは表示しません。
              </p>
            )}
          </div>
          <div className="section-rule">
            <span>デザインを整える</span>
          </div>
          <div className="field-grid">
            <label className="field">
              テーマ
              <select
                aria-label="テーマ"
                value={theme}
                onChange={(event) =>
                  setTheme(event.target.value as CardThemeName)
                }
              >
                {themes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              表示する言語数
              <select
                aria-label="表示する言語数"
                value={count}
                onChange={(event) =>
                  setCount(event.target.value as LanguageCountOption)
                }
              >
                <option value="5">上位 5 言語</option>
                <option value="8">上位 8 言語</option>
                <option value="10">上位 10 言語</option>
                <option value="all">すべての言語</option>
              </select>
            </label>
          </div>
          <p className="field-help">
            表示数を超える言語は「その他」にまとめ、全体の割合を保ちます。
          </p>
          <div className="switch-grid">
            <label className="check-row">
              <input
                type="checkbox"
                checked={animated}
                onChange={(event) => setAnimated(event.target.checked)}
              />
              アニメーション
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={border}
                onChange={(event) => setBorder(event.target.checked)}
              />
              枠線を表示
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={githubColors}
                onChange={(event) => setGithubColors(event.target.checked)}
              />
              GitHub の言語色
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={transparent}
                onChange={(event) => setTransparent(event.target.checked)}
              />
              背景を透明に
            </label>
          </div>
          <details className="advanced">
            <summary>言語の除外・グラフの開始位置</summary>
            <label className="field">
              グラフの開始位置
              <select
                aria-label="グラフの開始位置"
                value={boundary}
                onChange={(event) =>
                  setBoundary(event.target.value as BoundaryPosition)
                }
              >
                <option value="top">上</option>
                <option value="right">右</option>
                <option value="bottom">下</option>
                <option value="left">左</option>
              </select>
            </label>
            <div className="language-heading">
              <span>非表示にする言語</span>
              {hidden.length > 0 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setHidden([])}
                >
                  選択を解除
                </button>
              )}
            </div>
            <p className="field-help">
              チェックした言語を除外して割合を再計算します。
            </p>
            {stats?.languages.length ? (
              <div className="language-options">
                {stats.languages.map((language) => (
                  <label
                    className="check-row language-option"
                    key={language.name}
                  >
                    <input
                      type="checkbox"
                      checked={hiddenNames.has(language.name.toLowerCase())}
                      onChange={(event) =>
                        setHidden(
                          event.target.checked
                            ? [...hidden, language.name]
                            : hidden.filter(
                                (name) =>
                                  name.toLowerCase() !==
                                  language.name.toLowerCase(),
                              ),
                        )
                      }
                    />
                    <span>{language.name}</span>
                    <small>{formatPercent(language.percentage)}</small>
                  </label>
                ))}
              </div>
            ) : (
              <p className="empty-help">カードを作成すると言語を選べます。</p>
            )}
          </details>
          {status === "error" && (
            <div className="error-box" role="alert">
              {error}
              <span>
                ユーザー名や接続を確認して、もう一度作成してください。
              </span>
            </div>
          )}
        </form>
        <div className="method-note">
          <span className="dot" />
          フォーク・アーカイブを除外。バイト数に基づく割合で、習熟度を表すものではありません。
        </div>
      </section>

      <div className="preview-column">
        <section
          className="panel preview-panel"
          aria-labelledby="preview-title"
        >
          <div className="panel-heading">
            <div>
              <span className="eyebrow">02 / PREVIEW</span>
              <h2 id="preview-title">仕上がりを確認</h2>
            </div>
            <span className={imageReady ? "status-pill ready" : "status-pill"}>
              {status === "loading"
                ? "集計中"
                : imageUrl
                  ? imageReady
                    ? "プレビュー"
                    : "読み込み中"
                  : "サンプル"}
            </span>
          </div>
          <div
            className="preview-stage"
            aria-busy={
              status === "loading" ||
              Boolean(imageUrl && !imageReady && !imageFailed)
            }
          >
            {status === "loading" ? (
              <div className="preview-placeholder">
                <span className="loading-ring" />
                <strong>言語データを集計しています</strong>
                <p>リポジトリ数によって時間がかかります。</p>
              </div>
            ) : (
              <>
                <InteractiveLanguageCard
                  key={previewKey}
                  stats={previewStats}
                  options={{
                    animated,
                    border,
                    boundary,
                    githubColors,
                    interval: 2,
                    size: 420,
                    theme,
                    transparent,
                  }}
                />
                {/* Validate the actual export separately; interaction stays within the page. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {imageUrl && (
                  <img
                    key={imageUrl}
                    src={imageUrl}
                    alt=""
                    aria-hidden="true"
                    className="export-image-check"
                    referrerPolicy="no-referrer"
                    onLoad={() =>
                      setImageState({
                        url: imageUrl,
                        loaded: true,
                        error: false,
                      })
                    }
                    onError={() =>
                      setImageState({
                        url: imageUrl,
                        loaded: false,
                        error: true,
                      })
                    }
                  />
                )}
                {imageFailed && (
                  <p className="error-text" role="alert">
                    画像を取得できませんでした。「カードを作成」から再試行してください。
                  </p>
                )}
              </>
            )}
          </div>
          <div className="preview-caption" aria-live="polite">
            {status === "loading" ? (
              "GitHub から取得しています…"
            ) : stats && scan ? (
              <>
                <span className="mono">@{scan.username}</span>
                <span>
                  {stats.repositoryCount} リポジトリ / {stats.languages.length}{" "}
                  言語
                </span>
              </>
            ) : (
              "サンプルデータです。ユーザー名を入力して、自分の一枚に。"
            )}
          </div>
          <p className="interaction-help">
            円弧・凡例にカーソルを合わせると停止し、外すと続きから再生します。GitHub上では自動再生のみです。
          </p>
          {stats && !hasLanguages && (
            <p className="empty-notice">
              表示できる言語がありません。非表示の選択や対象リポジトリを確認してください。
            </p>
          )}
        </section>

        <section className="panel export-panel" aria-labelledby="export-title">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">03 / SHARE</span>
              <h2 id="export-title">プロフィールに飾る</h2>
            </div>
            {canExport && (
              <a
                className="text-button"
                href={imageUrl}
                download={`github-languages-${scan?.username}.svg`}
              >
                SVG を保存 ↗
              </a>
            )}
          </div>
          <div className="export-content">
            <div className="format-switch" aria-label="埋め込み形式">
              {(["markdown", "html"] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={format === value}
                  className={format === value ? "selected" : ""}
                  onClick={() => {
                    setFormat(value);
                    setCopyError("");
                  }}
                >
                  {value === "markdown" ? "Markdown" : "HTML"}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="embed-code">
              埋め込みコード
            </label>
            <textarea
              id="embed-code"
              ref={codeRef}
              readOnly
              value={embedCode}
              placeholder="カードを作成すると、埋め込みコードがここに表示されます。"
              rows={3}
              className="embed-code"
              onFocus={(event) => event.target.select()}
            />
            <button
              type="button"
              className="button primary copy-button"
              onClick={copyCode}
              disabled={!embedCode}
            >
              {copiedCode && copiedCode === embedCode
                ? "コピーしました ✓"
                : "埋め込みコードをコピー"}
            </button>
            <p className="field-help" aria-live="polite">
              {copyError ||
                (copiedCode && copiedCode === embedCode
                  ? "プロフィールの README.md に貼り付けてください。"
                  : "ユーザー名と同じ名前のリポジトリの README.md に貼り付けます。")}
            </p>
            {localOrigin && (
              <p className="local-notice">
                ローカルで確認中です。GitHub に飾るには、公開 HTTPS URL
                にデプロイしてからコードをコピーしてください。
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
