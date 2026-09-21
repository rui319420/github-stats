import { DEFAULT_LANGUAGE_COUNT } from "./chartOptions";

export interface LanguageData {
  name: string;
  bytes: number;
  percentage: number;
}

export interface LanguageStats {
  username: string;
  includePrivate: boolean;
  repositoryCount: number;
  languages: LanguageData[];
}

export type LanguageCount = 5 | 8 | 10 | "all";
export interface LanguageStatsDisplayOptions {
  count?: LanguageCount;
  hideLanguages?: string[];
}

export function customizeLanguageStats(
  stats: LanguageStats, options: LanguageStatsDisplayOptions
): LanguageStats {
  const hidden = new Set((options.hideLanguages ?? []).map((language) => language.trim().toLowerCase()));
  const visible = stats.languages
    .filter((language) => !hidden.has(language.name.toLowerCase()) && language.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
  const count = options.count === "all" ? visible.length : options.count ?? Number(DEFAULT_LANGUAGE_COUNT);
  const total = visible.reduce((sum, language) => sum + language.bytes, 0);
  const languages = visible.slice(0, count).map((language) => ({
    ...language, percentage: total === 0 ? 0 : language.bytes / total,
  }));
  const otherBytes = visible.slice(count).reduce((sum, language) => sum + language.bytes, 0);
  if (otherBytes > 0) languages.push({ name: "その他", bytes: otherBytes, percentage: otherBytes / total });
  return { ...stats, languages };
}
