"use client";

import { useEffect, useState } from "react";
interface Rate { username: string; limit: number; remaining: number; resetAt: number }
export default function GitHubConnectionStatus() {
  const [rate, setRate] = useState<Rate | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/github/connection", { signal: controller.signal, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "連携状態を確認できませんでした。");
        if (!controller.signal.aborted) { setRate(payload); setError(""); }
      } catch (cause) {
        if (!controller.signal.aborted) { setRate(null); setError(cause instanceof Error && !(cause instanceof TypeError) && !(cause instanceof SyntaxError) ? cause.message : "GitHub へ接続できませんでした。再試行してください。"); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [revision]);
  return <div className="connection-rate" aria-live="polite">
    {loading ? <span>利用枠を確認中…</span> : error ? <span className="error-text">{error}</span> : rate && <span>本人のAPI利用枠：残り <strong>{rate.remaining.toLocaleString("ja-JP")}</strong> / {rate.limit.toLocaleString("ja-JP")} 回 <small>（{new Date(rate.resetAt * 1000).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} にリセット）</small></span>}
    <button type="button" className="text-button" disabled={loading} onClick={() => { setLoading(true); setRevision((value) => value + 1); }}>再確認</button>
  </div>;
}
