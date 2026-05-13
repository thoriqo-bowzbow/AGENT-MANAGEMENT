import { describe, expect, it, vi } from "vitest";

describe("embeddings", () => {
  it("testEmbeddingConfig returns graceful error when gateway fails", async () => {
    vi.doMock("@/lib/9router", () => ({
      getActiveNineRouterCredential: vi.fn().mockRejectedValue(new Error("No active gateway")),
    }));

    vi.doMock("@/lib/ai/embeddings", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@/lib/ai/embeddings")>();
      return {
        ...actual,
        getEmbeddingStatus: vi.fn().mockResolvedValue({
          configured: false,
          modelName: "text-embedding-3-small",
          gateway: null,
        }),
      };
    });

    const { testEmbeddingConfig } = await import("@/lib/ai/embeddings");
    const result = await testEmbeddingConfig();

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.configured).toBe(false);

    vi.doUnmock("@/lib/9router");
    vi.doUnmock("@/lib/ai/embeddings");
  });
});