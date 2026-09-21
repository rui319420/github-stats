import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CARD_SIZE,
  MAX_CARD_SIZE,
  MIN_CARD_SIZE,
  parseCardSize,
} from "../app/lib/chartOptions";

test("parseCardSize uses the default for omitted and invalid values", () => {
  assert.equal(parseCardSize(null), DEFAULT_CARD_SIZE);
  assert.equal(parseCardSize(""), DEFAULT_CARD_SIZE);
  assert.equal(parseCardSize("not-a-size"), DEFAULT_CARD_SIZE);
});

test("parseCardSize clamps valid values to the supported range", () => {
  assert.equal(parseCardSize("299"), MIN_CARD_SIZE);
  assert.equal(parseCardSize(300), MIN_CARD_SIZE);
  assert.equal(parseCardSize("501.6"), 502);
  assert.equal(parseCardSize("9999"), MAX_CARD_SIZE);
});
