import { describe, expect, it, vi } from "vitest";
import { PreviewStore } from "./preview-store.js";

describe("PreviewStore", () => {
  it("makes confirmation tokens single use", () => {
    const store = new PreviewStore();
    const { token } = store.create({ items: [] }, { grand_total_naira: 1000 });
    expect(store.consume(token)).toBeDefined();
    expect(store.consume(token)).toBeUndefined();
  });

  it("rejects expired confirmations", () => {
    vi.useFakeTimers();
    const store = new PreviewStore(1000);
    const { token } = store.create({}, {});
    vi.advanceTimersByTime(1001);
    expect(store.consume(token)).toBeUndefined();
    vi.useRealTimers();
  });
});

