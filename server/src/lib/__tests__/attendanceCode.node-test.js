import test from "node:test";
import assert from "node:assert/strict";
import { codeFor, isValidCode, windowIndex, secondsLeft, haversineM, newSecret, WINDOW_SECS } from "../attendanceCode.js";

const T0 = 1_700_000_000_000;

test("code is 6 digits and stable within a window", () => {
  const s = newSecret();
  const idx = windowIndex(T0);
  const c = codeFor(s, idx);
  assert.match(c, /^\d{6}$/);
  assert.equal(codeFor(s, idx), c);
});

test("code differs across secrets", () => {
  assert.notEqual(codeFor(newSecret(), 1), codeFor(newSecret(), 1));
});

test("accepts current and previous window only", () => {
  const s = newSecret();
  const idx = windowIndex(T0);
  assert.equal(isValidCode(s, codeFor(s, idx), T0), true);
  assert.equal(isValidCode(s, codeFor(s, idx - 1), T0), true);
  assert.equal(isValidCode(s, codeFor(s, idx - 2), T0), false);
  assert.equal(isValidCode(s, codeFor(s, idx + 1), T0), false);
});

test("rejects malformed input", () => {
  const s = newSecret();
  for (const bad of ["", "12345", "1234567", "abcdef", null, undefined]) assert.equal(isValidCode(s, bad, T0), false);
});

test("secondsLeft stays within the window", () => {
  for (let i = 0; i < 100; i++) {
    const v = secondsLeft(T0 + i * 977);
    assert.ok(v >= 1 && v <= WINDOW_SECS);
  }
});

test("haversine: ~111km per degree of latitude, zero for same point", () => {
  assert.equal(haversineM({ lat: 6.5, lng: 3.3 }, { lat: 6.5, lng: 3.3 }), 0);
  const d = haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  assert.ok(d > 110_000 && d < 112_500);
});
