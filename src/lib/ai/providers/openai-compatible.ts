import type { ProviderAdapter, ProviderAdapterInput, ProviderStreamResult } from "@/lib/ai/types";

type OpenAIUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

function endpoint(baseUrl: string | null | undefined, path: string) {
  const normalized = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  return `${normalized}${path}`;
}

async function* parseSse(response: Response, usage: ProviderStreamResult["usage"]) {
  if (!response.body) {
    throw new Error("Provider returned an empty stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      const dataLines = event
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      for (const data of dataLines) {
        if (!data || data === "[DONE]") {
          continue;
        }

        const parsed = JSON.parse(data) as {
          model?: string;
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
          usage?: OpenAIUsage;
        };

        if (parsed.model) {
          usage.actualModel = parsed.model;
        }

        if (parsed.usage) {
          usage.inputTokens = parsed.usage.prompt_tokens;
          usage.outputTokens = parsed.usage.completion_tokens;
        }

        const text = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content;
        if (text) {
          yield text;
        }
      }
    }
  }
}

export const openAiCompatibleAdapter: ProviderAdapter = {
  async streamChat(input: ProviderAdapterInput) {
    const usage: ProviderStreamResult["usage"] = {};
    const response = await fetch(endpoint(input.provider.baseUrl, "/chat/completions"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: input.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI-compatible provider error ${response.status}: ${text.slice(0, 500)}`);
    }

    return {
      stream: parseSse(response, usage),
      usage,
    };
  },

  async healthCheck(input) {
    const response = await fetch(endpoint(input.provider.baseUrl, "/models"), {
      headers: {
        authorization: `Bearer ${input.apiKey}`,
      },
      signal: input.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Model list failed ${response.status}: ${text.slice(0, 300)}`);
    }
  },
};
