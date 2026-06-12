"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer, type PieSectorDataItem } from "recharts";
import { GITHUB_LANGUAGE_COLORS, getRandomColor } from "../lib/constants";

const renderActiveShape = ({
  cx, cy, midAngle, innerRadius, outerRadius,
  startAngle, endAngle, fill, payload, percent,
}: PieSectorDataItem) => {
  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-RADIAN * (midAngle ?? 0));
  const cos = Math.cos(-RADIAN * (midAngle ?? 0));
  const sx = (cx ?? 0) + ((outerRadius ?? 0) + 10) * cos;
  const sy = (cy ?? 0) + ((outerRadius ?? 0) + 10) * sin;
  const mx = (cx ?? 0) + ((outerRadius ?? 0) + 30) * cos;
  const my = (cy ?? 0) + ((outerRadius ?? 0) + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";
  const bytesText = (payload as { bytes?: number }).bytes
    ? `${((payload as { bytes: number }).bytes / 1024).toFixed(0)} KB`
    : "";

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} fontSize={26} fontWeight="bold">
        {(payload as { name: string }).name}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={(outerRadius ?? 0) + 6} outerRadius={(outerRadius ?? 0) + 10} fill={fill} />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={2} />
      <circle cx={ex} cy={ey} r={3} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#F2F3F5" fontWeight="bold">
        {`${((percent ?? 0) * 100).toFixed(1)}%`}
      </text>
      {bytesText && (
        <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#949BA4" fontSize={12}>
          {bytesText}
        </text>
      )}
    </g>
  );
};

interface LangData {
  name: string;
  bytes?: number;
  percentage: number;
}

interface LanguagesApiResponse {
  username?: string;
  includePrivate?: boolean;
  repositoryCount?: number;
  languages?: LangData[];
  error?: string;
}

interface LanguagePieChartProps {
  initialUsername?: string;
  isSignedIn?: boolean;
  privateCardError?: string;
  privateCardToken?: string;
}

type EmbedFormat = "markdown" | "html";

const INTERVAL_MS = 2000;
const INITIAL_DELAY_MS = 1000;
const RESUME_DELAY_MS = 100;

export default function LanguagePieChart({
  initialUsername = "",
  isSignedIn = false,
  privateCardError,
  privateCardToken,
}: LanguagePieChartProps) {
  const [mounted, setMounted] = useState(false);
  const [origin, setOrigin] = useState("");
  const [data, setData] = useState<LangData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [activeUsername, setActiveUsername] = useState("");
  const [includePrivate, setIncludePrivate] = useState(false);
  const [repositoryCount, setRepositoryCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [embedFormat, setEmbedFormat] = useState<EmbedFormat>("markdown");
  const [activeIndex, setActiveIndex] = useState(0);

  const dataLengthRef = useRef(0);
  const activeIndexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopLoop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  const startLoop = useCallback((delay = 0) => {
    stopLoop();
    resumeTimerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        activeIndexRef.current = (activeIndexRef.current + 1) % dataLengthRef.current;
        setActiveIndex(activeIndexRef.current);
      }, INTERVAL_MS);
    }, delay);
  }, [stopLoop]);

  const renderShape = useCallback((props: PieSectorDataItem & { index?: number }) => {
    if (props.index === activeIndex) return renderActiveShape(props);
    return (
      <Sector
        cx={props.cx}
        cy={props.cy}
        innerRadius={props.innerRadius}
        outerRadius={props.outerRadius}
        startAngle={props.startAngle}
        endAngle={props.endAngle}
        fill={props.fill}
      />
    );
  }, [activeIndex]);

  useEffect(() => {
    setMounted(true);
    setOrigin(window.location.origin);
  }, []);

  const buildImageUrl = useCallback((username: string, privateScope: boolean) => {
    if (!origin) return "";
    const params = new URLSearchParams();
    if (username.trim()) params.set("username", username.trim());
    if (privateScope) {
      params.set("include_private", "true");
      if (privateCardToken) params.set("card_token", privateCardToken);
    }
    return `${origin}/api/languages.svg?${params.toString()}`;
  }, [origin, privateCardToken]);

  const embedCode = useMemo(() => {
    const imageUrl = buildImageUrl(activeUsername || usernameInput, includePrivate);
    if (!imageUrl || !origin) return "";
    if (embedFormat === "html") {
      return `<img src="${imageUrl}" alt="GitHub Language Stats" />`;
    }
    return `[![GitHub Language Stats](${imageUrl})](${origin})`;
  }, [activeUsername, buildImageUrl, embedFormat, includePrivate, origin, usernameInput]);

  const fetchData = useCallback(async (username: string, privateScope: boolean) => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const params = new URLSearchParams();
      const trimmed = username.trim();
      if (trimmed) params.set("username", trimmed);
      if (privateScope) {
        params.set("include_private", "true");
        if (privateCardToken) params.set("card_token", privateCardToken);
      }
      params.set("t", String(Date.now()));
      const res = await fetch(`/api/languages?${params.toString()}`);
      const payload = (await res.json()) as LanguagesApiResponse;
      if (!res.ok) {
        throw new Error(payload.error ?? "Language fetch failed.");
      }

      const finalData = payload.languages ?? [];
      setData(finalData);
      setActiveUsername(payload.username ?? trimmed);
      setRepositoryCount(payload.repositoryCount ?? 0);
      if (!trimmed && payload.username) setUsernameInput(payload.username);

      dataLengthRef.current = finalData.length;
      activeIndexRef.current = 0;
      setActiveIndex(0);
      if (finalData.length > 0) {
        startLoop(INITIAL_DELAY_MS);
      } else {
        stopLoop();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Language fetch failed.";
      setError(message);
      setData([]);
      setRepositoryCount(0);
      stopLoop();
    } finally {
      setLoading(false);
    }
  }, [privateCardToken, startLoop, stopLoop]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialUsernameFromUrl = params.get("username")?.trim() ?? "";
    const initialPrivate = params.get("include_private") === "true";
    const resolvedUsername = initialUsernameFromUrl || initialUsername;
    setUsernameInput(resolvedUsername);
    setIncludePrivate(initialPrivate);
    fetchData(resolvedUsername, initialPrivate);
    return () => stopLoop();
  }, [fetchData, initialUsername, stopLoop]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = usernameInput.trim();
    const url = new URL(window.location.href);
    if (trimmed) {
      url.searchParams.set("username", trimmed);
    } else {
      url.searchParams.delete("username");
    }
    if (includePrivate) {
      url.searchParams.set("include_private", "true");
    } else {
      url.searchParams.delete("include_private");
    }
    window.history.replaceState({}, "", url);
    fetchData(trimmed, includePrivate);
  };

  const copyEmbedCode = async () => {
    if (!embedCode) return;
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
  };

  return (
    <div className="flex w-full flex-col rounded-lg border border-[#2ea043]/40 bg-[#0d1117] p-4 shadow-[0_0_20px_rgba(46,160,67,0.15)] md:p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-wider text-[#F2F3F5]">Language Distribution</h2>
        <p className="mt-1 text-xs text-[#949BA4]">
          {activeUsername ? `@${activeUsername} · ${repositoryCount} repositories` : "Loading..."}
        </p>
        <form className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={handleSubmit}>
          <input
            value={usernameInput}
            onChange={(event) => setUsernameInput(event.target.value)}
            placeholder="GitHub username"
            className="h-10 rounded-md border border-[#30363d] bg-[#161b22] px-3 text-sm text-[#F2F3F5] outline-none transition focus:border-[#2ea043]"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-10 rounded-md bg-[#238636] px-5 text-sm font-semibold text-white transition hover:bg-[#2ea043] disabled:cursor-not-allowed disabled:opacity-70"
          >
            Load
          </button>
          <label className="flex items-center gap-2 text-sm text-[#c9d1d9] md:col-span-2">
            <input
              type="checkbox"
              checked={includePrivate}
              onChange={(event) => setIncludePrivate(event.target.checked)}
              className="h-4 w-4 accent-[#2ea043]"
            />
            Include private repositories
          </label>
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

      {!mounted || loading ? (
        <div className="flex h-[290px] items-center justify-center">
          <div className="flex items-center gap-2 text-[#949BA4]">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading...
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-[290px] items-center justify-center">
          <p className="text-center text-sm text-[#636e7b]">{error ?? "No data available"}</p>
        </div>
      ) : (
        <div className="h-[290px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
            <PieChart margin={{ top: 20, right: 0, bottom: 0, left: 0 }}>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="50%"
                outerRadius="70%"
                dataKey="percentage"
                stroke="none"
                shape={renderShape}
                onMouseEnter={(_, index) => {
                  stopLoop();
                  setActiveIndex(index);
                  activeIndexRef.current = index;
                }}
                onMouseLeave={() => startLoop(RESUME_DELAY_MS)}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={GITHUB_LANGUAGE_COLORS[entry.name] ?? getRandomColor(entry.name)}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
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
