import { describe, it, expect, beforeEach, vi } from "vitest";

const REAL_SET = Storage.prototype.setItem;

beforeEach(() => {
  localStorage.clear();
  Storage.prototype.setItem = REAL_SET;
  delete Storage.prototype.__scQuotaSafe;
  vi.resetModules();
});

function quotaError() {
  const e = new Error("quota exceeded");
  e.name = "QuotaExceededError";
  return e;
}

describe("safeStorage", () => {
  it("evicts cache keys and retries a write that hit quota", async () => {
    // Seed with the real implementation first
    localStorage.setItem("sc_resources_list", "cached");
    localStorage.setItem("sc_roadmap_anatomy", "cached");
    localStorage.setItem("scholars-circle-auth", "keepme");

    let calls = 0;
    Storage.prototype.setItem = function (k, v) {
      calls++;
      if (calls === 1) throw quotaError();
      return REAL_SET.call(this, k, v);
    };

    await import("./safeStorage");

    localStorage.setItem("user_data", "value");
    expect(localStorage.getItem("user_data")).toBe("value");
    expect(localStorage.getItem("sc_resources_list")).toBeNull();
    expect(localStorage.getItem("sc_roadmap_anatomy")).toBeNull();
    expect(localStorage.getItem("scholars-circle-auth")).toBe("keepme");
  });

  it("rethrows the quota error when nothing evictable remains", async () => {
    localStorage.setItem("scholars-circle-auth", "keepme");

    Storage.prototype.setItem = function () {
      throw quotaError();
    };

    await import("./safeStorage");

    expect(() => localStorage.setItem("k", "v")).toThrow("quota exceeded");
    expect(localStorage.getItem("scholars-circle-auth")).toBe("keepme");
  });

  it("sweeps expired cache entries at install", async () => {
    const old = JSON.stringify({ data: [], ts: Date.now() - 40 * 24 * 60 * 60 * 1000 });
    const fresh = JSON.stringify({ data: [], ts: Date.now() });
    localStorage.setItem("sc_arcade_short_1_10", old);
    localStorage.setItem("sc_resources_list", fresh);

    await import("./safeStorage");

    expect(localStorage.getItem("sc_arcade_short_1_10")).toBeNull();
    expect(localStorage.getItem("sc_resources_list")).toBe(fresh);
  });
});
