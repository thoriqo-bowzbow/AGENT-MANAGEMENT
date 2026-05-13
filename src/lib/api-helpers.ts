import { ZodError } from "zod";

import { jsonError } from "@/lib/utils";

export async function handleApi(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid request", 422, {
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    console.error(error);
    return jsonError(error instanceof Error ? error.message : "Internal server error", 500);
  }
}

export async function readJson<T>(request: Request, fallback: T): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return fallback;
  }
}
