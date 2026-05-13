import type { Provider, ProviderApiKey, Route } from "@/generated/prisma/client";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type RouterChatMessage = {
  role: ChatRole;
  content: string;
};

export type StreamUsage = {
  inputTokens?: number;
  outputTokens?: number;
  actualModel?: string;
};

export type ProviderStreamResult = {
  stream: AsyncIterable<string>;
  usage: StreamUsage;
};

export type ProviderAdapterInput = {
  provider: Provider;
  apiKey: string;
  model: string;
  messages: RouterChatMessage[];
  signal?: AbortSignal;
};

export type ProviderAdapter = {
  streamChat(input: ProviderAdapterInput): Promise<ProviderStreamResult>;
  healthCheck(input: Omit<ProviderAdapterInput, "messages">): Promise<void>;
};

export type RouterAttempt = {
  route: Route;
  provider: Provider;
  apiKey: ProviderApiKey;
  model: string;
  usageLogId: string;
  usage: StreamUsage;
};

export type RoutedStream = {
  attempt: RouterAttempt;
  stream: AsyncIterable<string>;
  finalize: (content: string) => Promise<void>;
  fail: (error: unknown) => Promise<void>;
};
