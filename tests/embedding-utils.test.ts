import { describe, expect, it } from "vitest";

import { cosineSimilarity, keywordScore, parseEmbeddingResponse, vectorFromJson } from "../src/lib/ai/embedding-utils";

describe("embedding utils", () => {
  it("parses OpenAI-compatible embedding responses in index order", () => {
    const parsed = parseEmbeddingResponse({
      data: [
        { index: 1, embedding: [0, 1] },
        { index: 0, embedding: [1, 0] },
      ],
      usage: { prompt_tokens: 4, total_tokens: 4 },
    });

    expect(parsed.vectors).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(parsed.usage?.totalTokens).toBe(4);
  });

  it("calculates cosine similarity", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("rejects mismatched embedding dimensions", () => {
    expect(() => cosineSimilarity([1, 0], [1])).toThrow("Dimensi embedding tidak cocok: 2 vs 1");
  });

  it("reads vector JSON from arrays and strings", () => {
    expect(vectorFromJson([1, 2, 3])).toEqual([1, 2, 3]);
    expect(vectorFromJson("[1,2,3]")).toEqual([1, 2, 3]);
    expect(vectorFromJson({ nope: true })).toBeNull();
  });

  it("scores keyword fallback matches", () => {
    expect(keywordScore("router dokumen", "dokumen memakai router 9Router")).toBe(1);
    expect(keywordScore("router dokumen", "hanya router")).toBe(0.5);
  });
});
