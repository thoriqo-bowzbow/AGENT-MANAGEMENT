import { NextRequest } from "next/server";
import { nanoid } from "nanoid";

import { createRoutedChatStream } from "@/lib/ai/router";
import { requireV1Access } from "@/lib/auth";
import { handleApi, readJson } from "@/lib/api-helpers";

type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleApi(async () => {
    const user = await requireV1Access(request);
    const body = await readJson<{
      model?: string;
      messages?: OpenAIMessage[];
      stream?: boolean;
    }>(request, {});

    if (!body.messages?.length) {
      return Response.json({ error: "messages are required" }, { status: 422 });
    }

    const routed = await createRoutedChatStream({
      userId: user?.id,
      routeSlug: body.model === "general-main" ? "general-main" : undefined,
      messages: body.messages,
      signal: request.signal,
    });

    const completionId = `chatcmpl_${nanoid(18)}`;

    if (body.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          let content = "";
          try {
            for await (const chunk of routed.stream) {
              content += chunk;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    id: completionId,
                    object: "chat.completion.chunk",
                    choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }],
                  })}\n\n`,
                ),
              );
            }
            await routed.finalize(content);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  id: completionId,
                  object: "chat.completion.chunk",
                  choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
                })}\n\n`,
              ),
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch (error) {
            await routed.fail(error);
            controller.error(error);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
        },
      });
    }

    let content = "";
    for await (const chunk of routed.stream) {
      content += chunk;
    }
    await routed.finalize(content);

    return Response.json({
      id: completionId,
      object: "chat.completion",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: routed.attempt.usage.inputTokens,
        completion_tokens: routed.attempt.usage.outputTokens,
      },
    });
  });
}
