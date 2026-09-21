import type { LanguageStats } from "./languageStats";

export const SAMPLE_LANGUAGE_STATS: LanguageStats = {
  username: "your-name",
  includePrivate: false,
  repositoryCount: 24,
  languages: [
    { name: "TypeScript", bytes: 432000, percentage: .432 },
    { name: "Python", bytes: 248000, percentage: .248 },
    { name: "JavaScript", bytes: 176000, percentage: .176 },
    { name: "CSS", bytes: 94000, percentage: .094 },
    { name: "HTML", bytes: 50000, percentage: .05 },
  ],
};
