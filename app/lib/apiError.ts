export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryAfter?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export interface SafeApiError {
  message: string;
  status: number;
  retryAfter?: number;
}

export function getApiError(error: unknown): SafeApiError {
  if (error instanceof ApiError) {
    return { message: error.message, status: error.status, retryAfter: error.retryAfter };
  }
  // Never return upstream exception messages: they can contain private URLs or credentials.
  const upstream = error as { status?: number; name?: string; response?: { headers?: Record<string, string> } } | null;
  const status = upstream?.status;
  const headers = upstream?.response?.headers;
  if (status === 429 || (status === 403 && (headers?.["x-ratelimit-remaining"] === "0" || headers?.["retry-after"]))) {
    const retry = Number(headers?.["retry-after"]);
    const reset = Number(headers?.["x-ratelimit-reset"]);
    const wait = Number.isFinite(retry) && retry > 0 ? retry : reset > Date.now() / 1000 ? reset - Date.now() / 1000 : 60;
    return { status: 429, message: "GitHub API の利用上限に達しました。時間をおいて再試行してください。", retryAfter: Math.ceil(Math.min(wait, 86400)) };
  }
  if (status === 401) return { status: 401, message: "GitHub の認証が失効しています。もう一度連携してください。" };
  if (status === 403) return { status: 403, message: "GitHub のアクセス権限または一時的な制限を確認してください。" };
  if (status === 404) return { status: 404, message: "ユーザーが見つからないか、対象リポジトリへアクセスできません。" };
  if (upstream?.name === "AbortError" || upstream?.name === "TimeoutError" || status === 504) {
    return { status: 504, message: "GitHub からの応答がタイムアウトしました。再試行してください。" };
  }
  return { status: 502, message: "GitHub のデータを取得できませんでした。時間をおいて再試行してください。" };
}
