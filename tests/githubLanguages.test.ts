import assert from "node:assert/strict";
import { test } from "node:test";
import {
  customizeLanguageStats,
  parseBooleanParam,
  parseHiddenLanguages,
  parseLanguageCount,
  resolveUsername,
  type LanguageStats,
} from "../app/lib/githubLanguages";

function statsFrom(entries: Array<[string, number]>): LanguageStats {
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  return {
    username: "alice",
    includePrivate: false,
    repositoryCount: entries.length,
    languages: entries.map(([name, bytes]) => ({
      name,
      bytes,
      percentage: total === 0 ? 0 : bytes / total,
    })),
  };
}

test("language query parsers accept the documented values and safe defaults", () => {
  assert.equal(parseBooleanParam("TRUE"), true);
  assert.equal(parseBooleanParam("on"), true);
  assert.equal(parseBooleanParam("false"), false);
  assert.equal(parseBooleanParam("unknown"), false);
  assert.equal(parseLanguageCount("5"), 5);
  assert.equal(parseLanguageCount("all"), "all");
  assert.equal(parseLanguageCount("invalid"), 8);
  assert.deepEqual(parseHiddenLanguages(" HTML, CSS ,,TypeScript "), [
    "HTML",
    "CSS",
    "TypeScript",
  ]);
});

test("resolveUsername validates explicit and environment usernames", () => {
  const previousUsername = process.env.GITHUB_USERNAME;
  delete process.env.GITHUB_USERNAME;
  try {
    assert.equal(resolveUsername("  alice "), "alice");
    assert.equal(resolveUsername("invalid username"), null);
    assert.equal(resolveUsername(null), null);
    process.env.GITHUB_USERNAME = "environment-user";
    assert.equal(resolveUsername(null), "environment-user");
  } finally {
    if (previousUsername === undefined) {
      delete process.env.GITHUB_USERNAME;
    } else {
      process.env.GITHUB_USERNAME = previousUsername;
    }
  }
});

test("top language selection keeps the remainder in an Other bucket", () => {
  const result = customizeLanguageStats(
    statsFrom([
      ["TypeScript", 5000],
      ["Python", 3000],
      ["Rust", 1000],
      ["Go", 500],
      ["Ruby", 500],
      ["Java", 300],
      ["C++", 200],
    ]),
    { count: 5 }
  );

  assert.deepEqual(
    result.languages.map(({ name }) => name),
    ["TypeScript", "Python", "Rust", "Go", "Ruby", "その他"]
  );
  assert.equal(result.languages.at(-1)?.bytes, 500);
  assert.ok(Math.abs(result.languages.reduce((sum, language) => sum + language.percentage, 0) - 1) < 1e-12);
  assert.ok(Math.abs((result.languages.at(-1)?.percentage ?? 0) - 500 / 10500) < 1e-12);
});

test("hiding a language happens before ranking and percentage recalculation", () => {
  const result = customizeLanguageStats(
    statsFrom([
      ["TypeScript", 5000],
      ["Python", 3000],
      ["Rust", 1000],
      ["Go", 500],
      ["Ruby", 500],
      ["Java", 300],
      ["C++", 200],
    ]),
    { count: 5, hideLanguages: ["python"] }
  );

  assert.deepEqual(
    result.languages.map(({ name }) => name),
    ["TypeScript", "Rust", "Go", "Ruby", "Java", "その他"]
  );
  assert.deepEqual(
    result.languages.map(({ bytes }) => bytes),
    [5000, 1000, 500, 500, 300, 200]
  );
  assert.ok(Math.abs(result.languages[0].percentage - 5000 / 7500) < 1e-12);
  assert.ok(Math.abs(result.languages[5].percentage - 200 / 7500) < 1e-12);
  assert.ok(Math.abs(result.languages.reduce((sum, language) => sum + language.percentage, 0) - 1) < 1e-12);
});

test("count=all retains every language and normalizes its percentages", () => {
  const result = customizeLanguageStats(
    statsFrom([
      ["TypeScript", 50],
      ["ShaderLab", 30],
      ["Jupyter Notebook", 20],
    ]),
    { count: "all" }
  );

  assert.deepEqual(
    result.languages.map(({ name }) => name),
    ["TypeScript", "ShaderLab", "Jupyter Notebook"]
  );
  assert.equal(result.languages.length, 3);
  assert.ok(Math.abs(result.languages.reduce((sum, language) => sum + language.percentage, 0) - 1) < 1e-12);
});

test("empty language data remains empty", () => {
  const result = customizeLanguageStats(statsFrom([]), { count: 5 });
  assert.deepEqual(result.languages, []);
});
