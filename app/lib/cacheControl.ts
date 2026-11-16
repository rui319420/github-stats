const STALE_SECONDS = 86_400;

export const PRIVATE_CACHE_CONTROL = "private, no-store";

// GitHub's image proxy gives up after a few seconds, so a visitor must never
// wait for a fresh aggregation. Once `seconds` have passed the CDN keeps
// serving the previous image for up to a day and refreshes it in the background.
export function publicImageCacheControl(seconds: number) {
  return `public, max-age=${seconds}, s-maxage=${seconds}, stale-while-revalidate=${STALE_SECONDS}`;
}
