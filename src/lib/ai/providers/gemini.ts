import { GoogleGenAI } from "@google/genai";

import type { ProviderAdapter, ProviderAdapterInput, ProviderStreamResult } from "@/lib/ai/types";

function toGeminiContents(messages: ProviderAdapterInput["messages"]) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
}

function systemInstruction(messages: ProviderAdapterInput["messages"]) {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  return system || undefined;
}

export const geminiAdapter: ProviderAdapter = {
  async streamChat(input) {
    const usage: ProviderStreamResult["usage"] = {};
    const ai = new GoogleGenAI({ apiKey: input.apiKey });
    const response = await ai.models.generateContentStream({
      model: input.model,
      contents: toGeminiContents(input.messages),
      config: {
        systemInstruction: systemInstruction(input.messages),
      },
    });

    async function* stream() {
      for await (const chunk of response) {
        const metadata = chunk.usageMetadata;
        if (metadata) {
          usage.inputTokens = metadata.promptTokenCount ?? usage.inputTokens;
          usage.outputTokens = metadata.candidatesTokenCount ?? usage.outputTokens;
        }

        if (chunk.text) {
          yield chunk.text;
        }
      }
    }

    return { stream: stream(), usage };
  },

  async healthCheck(input) {
    const ai = new GoogleGenAI({ apiKey: input.apiKey });
    await ai.models.generateContent({
      model: input.model,
      contents: "Reply with ok.",
    });
  },
};
