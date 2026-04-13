"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { PieChart, Pie, Cell, Sector, ResponsiveContainer, type PieSectorDataItem } from "recharts";
import { GITHUB_LANGUAGE_COLORS, getRandomColor } from "../lib/constants";

const renderActiveShape = ({ cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent }: PieSectorDataItem) => {
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
  languages?: LangData[];
  error?: string;
}

const INTERVAL_MS = 2000;
const INITIAL_DELAY_MS = 1000;
const RESUME_DELAY_MS = 100;

export default function LanguagePieChart() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<LangData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [activeUsername, setActiveUsername] = useState("");
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
    return <Sector cx={props.cx} cy={props.cy} innerRadius={props.innerRadius} outerRadius={props.outerRadius} startAngle={props.startAngle} endAngle={props.endAngle} fill={props.fill} />;
  }, [activeIndex]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchData = useCallback(async (username?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const trimmed = username?.trim();
      if (trimmed) params.set("username", trimmed);
      params.set("t", String(Date.now()));
      const query = params.toString();
      const res = await fetch(`/api/languages?${query}`);
      const payload = (await res.json()) as LanguagesApiResponse;
      if (!res.ok) {
        throw new Error(payload.error ?? "Language fetch failed.");
      }

      const finalData = payload.languages ?? [];
      setData(finalData);
      setActiveUsername(payload.username ?? trimmed ?? "");
      if (!trimmed && payload.username) {
        setUsernameInput(payload.username);
      }

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
      stopLoop();
    } finally {
      setLoading(false);
    }
  }, [startLoop, stopLoop]);

  useEffect(() => {
    const initialUsername = new URLSearchParams(window.location.search).get("username")?.trim() ?? "";
    if (initialUsername) setUsernameInput(initialUsername);
    fetchData(initialUsername);
    return () => stopLoop();
  }, [fetchData, stopLoop]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = usernameInput.trim();
    const url = new URL(window.location.href);
    if (trimmed) {
      url.searchParams.set("username", trimmed);
    } else {
      url.searchParams.delete("username");
    }
    window.history.replaceState({}, "", url);
    fetchData(trimmed);
  };

  return (
    <div className="flex h-[450px] w-full flex-col rounded-xl border border-[#2ea043]/40 bg-[#0d1117] p-4 shadow-[0_0_20px_rgba(46,160,67,0.15)] md:p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-wider text-[#F2F3F5]">Language Distribution</h2>
        <p className="mt-1 text-xs text-[#949BA4]">{activeUsername ? `User: ${activeUsername}` : "User not selected"}</p>
        <form className="mt-3 flex gap-2" onSubmit={handleSubmit}>
          <input
            value={usernameInput}
            onChange={(event) => setUsernameInput(event.target.value)}
            placeholder="GitHub username"
            className="h-9 flex-1 rounded-md border border-[#2d3748] bg-[#161b22] px-3 text-sm text-[#F2F3F5] outline-none transition focus:border-[#2ea043]"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-9 rounded-md bg-[#2ea043] px-4 text-sm font-semibold text-white transition hover:bg-[#3fb950] disabled:cursor-not-allowed disabled:opacity-70"
          >
            Load
          </button>
        </form>
      </div>
      {!mounted || loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-2 text-[#949BA4]">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading...
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-center text-sm text-[#636e7b]">{error ?? "No data available"}</p>
        </div>
      ) : (
        <div className="flex-1 min-h-[280px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
            <PieChart margin={{ top: 20, right: 0, bottom: 0, left: 0 }}>
              <Pie data={data} cx="50%" cy="50%" innerRadius="50%" outerRadius="70%" dataKey="percentage" stroke="none" shape={renderShape}
              onMouseEnter={(_, index) => { stopLoop(); setActiveIndex(index); activeIndexRef.current = index; }}
              onMouseLeave={() => startLoop(RESUME_DELAY_MS)}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={GITHUB_LANGUAGE_COLORS[entry.name] ?? getRandomColor(entry.name)} />
              ))}
            </Pie>
          </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}