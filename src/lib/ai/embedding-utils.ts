export type ParsedEmbeddingResponse = {
  vectors: number[][];
  usage?: {
    promptTokens?: number;
    totalTokens?: number;
  };
};

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

export function vectorFromJson(value: unknown): number[] | null {
  if (isNumberArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return isNumberArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || !right.length) {
    return 0;
  }

  if (left.length !== right.length) {
    throw new Error(`Dimensi embedding tidak cocok: ${left.length} vs ${right.length}`);
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] || 0;
    const rightValue = right[index] || 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function parseEmbeddingResponse(payload: unknown): ParsedEmbeddingResponse {
  const objectPayload = payload as {
    data?: Array<{ embedding?: unknown; index?: number }>;
    usage?: { prompt_tokens?: number; total_tokens?: number };
  };

  const data = objectPayload.data;
  if (!Array.isArray(data) || !data.length) {
    throw new Error("Embedding response tidak berisi data embedding.");
  }

  const vectors = [...data]
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((item) => {
      const vector = vectorFromJson(item.embedding);
      if (!vector) {
        throw new Error("Format embedding tidak valid.");
      }
      return vector;
    });

  return {
    vectors,
    usage: {
      promptTokens: objectPayload.usage?.prompt_tokens,
      totalTokens: objectPayload.usage?.total_tokens,
    },
  };
}

export function keywordTerms(query: string) {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9\u00c0-\u024f]+/i)
        .map((term) => term.trim())
        .filter((term) => term.length >= 4),
    ),
  );
}

export function keywordScore(query: string, content: string) {
  const terms = keywordTerms(query);

  if (!terms.length) {
    return 0;
  }

  const haystack = content.toLowerCase();
  const matches = terms.filter((term) => haystack.includes(term)).length;
  return matches / terms.length;
}
