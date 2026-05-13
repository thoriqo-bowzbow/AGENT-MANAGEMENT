import { z } from "zod";

import { ProviderType } from "@/generated/prisma/enums";

export const setupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createConversationSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  routeId: z.string().optional(),
});

export const chatStreamSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(50_000),
  routeId: z.string().optional(),
});

export const createProviderSchema = z.object({
  name: z.string().min(2).max(80),
  type: z.nativeEnum(ProviderType),
  baseUrl: z.string().url().optional().or(z.literal("")),
  modelName: z.string().min(1).max(120),
  routeSlug: z.string().optional(),
  priority: z.coerce.number().int().min(1).max(999).default(100),
});

export const nineRouterConfigSchema = z.object({
  baseUrl: z.string().url().default("http://localhost:20128/v1"),
  apiKey: z.string().optional(),
  modelName: z.string().min(1).max(160).default("everything"),
  routeSlug: z.string().min(1).max(80).default("general-main"),
});

export const nineRouterGatewaySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(80).default("9Router Gateway"),
  baseUrl: z.string().url().default("http://localhost:20128/v1"),
  apiKey: z.string().optional(),
  keyLabel: z.string().min(1).max(50).default("gateway-key"),
  modelName: z.string().min(1).max(160).default("everything"),
  makeActive: z.boolean().default(true),
});

export const nineRouterActiveRouteSchema = z.object({
  providerId: z.string().min(1),
  modelName: z.string().min(1).max(160),
  keyId: z.string().optional(),
  routeSlug: z.string().min(1).max(80).default("general-main"),
});

export const nineRouterKeySchema = z.object({
  apiKey: z.string().min(1),
  label: z.string().min(1).max(50).default("gateway-key"),
  makeActive: z.boolean().default(true),
});

export const nineRouterModelSchema = z.object({
  modelName: z.string().min(1).max(160),
});

export const bulkKeysSchema = z.object({
  keys: z.string().min(1),
  labelPrefix: z.string().min(1).max(40).default("key"),
});

export const createRouteSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(80),
  description: z.string().max(240).optional(),
});

export const routerTestSchema = z.object({
  routeId: z.string().optional(),
  prompt: z.string().min(1).max(2000).default("Reply with: Riqo router ok"),
});

export const createMemorySchema = z.object({
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(20_000),
  scope: z.enum(["GLOBAL", "USER", "PROJECT", "CONVERSATION"]).default("USER"),
  conversationId: z.string().optional(),
});

export const updateMemorySchema = createMemorySchema.partial().extend({
  isEnabled: z.boolean().optional(),
});

export const searchSchema = z.object({
  query: z.string().min(1).max(1000),
  conversationId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const embeddingSettingsSchema = z.object({
  modelName: z.string().min(1).max(160).default("text-embedding-3-small"),
});

export const memorySuggestSchema = z.object({
  conversationId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(5).default(3),
});
