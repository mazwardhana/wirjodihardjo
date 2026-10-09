import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter, consumeRateLimit, resetRateLimiter } from "./rate-limit";

test("consumeRateLimit mengizinkan sampai batas lalu menolak", () => {
  const limiter = createRateLimiter();
  for (let i = 0; i < 30; i++) assert.equal(limiter.consume("ip-1", 30, 60_000), true);
  assert.equal(limiter.consume("ip-1", 30, 60_000), false);
});

test("consumeRateLimit memisahkan kunci yang berbeda", () => {
  const limiter = createRateLimiter();
  for (let i = 0; i < 30; i++) limiter.consume("ip-1", 30, 60_000);
  assert.equal(limiter.consume("ip-2", 30, 60_000), true);
});

test("consumeRateLimit mengizinkan lagi setelah jendela lewat", () => {
  let now = 0;
  const limiter = createRateLimiter(() => now);
  for (let i = 0; i < 30; i++) limiter.consume("ip-1", 30, 60_000);
  now = 60_001;
  assert.equal(limiter.consume("ip-1", 30, 60_000), true);
});

test("singleton consumeRateLimit dipakai ulang dan bisa direset", () => {
  resetRateLimiter();
  for (let i = 0; i < 5; i++) assert.equal(consumeRateLimit("k", 5, 60_000), true);
  assert.equal(consumeRateLimit("k", 5, 60_000), false);
  resetRateLimiter();
  assert.equal(consumeRateLimit("k", 5, 60_000), true);
});
