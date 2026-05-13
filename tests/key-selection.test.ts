import { describe, expect, it } from "vitest";

import { sortKeyCandidates } from "../src/lib/ai/key-selection";

describe("round-robin key selection", () => {
  it("prefers the least recently used active key within priority", () => {
    const sorted = sortKeyCandidates([
      {
        id: "recent",
        priority: 1,
        lastUsedAt: new Date("2026-05-12T10:00:00Z"),
        createdAt: new Date("2026-05-01T00:00:00Z"),
      },
      {
        id: "older",
        priority: 1,
        lastUsedAt: new Date("2026-05-12T09:00:00Z"),
        createdAt: new Date("2026-05-02T00:00:00Z"),
      },
    ]);

    expect(sorted[0].id).toBe("older");
  });

  it("uses priority before last-used time", () => {
    const sorted = sortKeyCandidates([
      {
        id: "low-priority",
        priority: 50,
        lastUsedAt: null,
        createdAt: new Date("2026-05-01T00:00:00Z"),
      },
      {
        id: "high-priority",
        priority: 1,
        lastUsedAt: new Date("2026-05-12T10:00:00Z"),
        createdAt: new Date("2026-05-02T00:00:00Z"),
      },
    ]);

    expect(sorted[0].id).toBe("high-priority");
  });
});
