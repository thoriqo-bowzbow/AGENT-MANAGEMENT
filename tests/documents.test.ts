import { describe, expect, it } from "vitest";

import { chunkText, safeStorageName } from "../src/lib/documents/extract";

describe("document helpers", () => {
  it("chunks text with overlap", () => {
    const chunks = chunkText("a".repeat(3200), 1000, 100);

    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks[0]).toHaveLength(1000);
    expect(chunks[1]).toHaveLength(1000);
  });

  it("sanitizes storage names", () => {
    const name = safeStorageName("my weird/file name.pdf");

    expect(name).toMatch(/^file-name-\d+\.pdf$/);
  });
});
