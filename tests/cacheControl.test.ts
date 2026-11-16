import assert from "node:assert/strict";
import { test } from "node:test";
import { PRIVATE_CACHE_CONTROL, publicImageCacheControl } from "../app/lib/cacheControl";

test("public images are served stale while the CDN revalidates", () => {
  assert.equal(publicImageCacheControl(300), "public, max-age=300, s-maxage=300, stale-while-revalidate=86400");
  assert.equal(PRIVATE_CACHE_CONTROL, "private, no-store");
});
