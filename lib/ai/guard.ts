import type { AIProvider, StructuredRequest, StructuredResult } from "./types";

/**
 * Provider-agnostic request limits, applied before any provider is called.
 *
 * Inputs are already bounded where they enter (CV text 50,000 chars, job
 * description 20,000, answers and portfolio fields by their own schemas), so
 * the largest legitimate prompt is well under these caps. The guard is a
 * backstop against excessive token usage if a future code path forgets a limit.
 */
export const MAX_PROMPT_CHARS = 150_000;
export const MAX_SYSTEM_CHARS = 20_000;
export const MAX_OUTPUT_TOKENS = 16_000;

export function checkRequest<T>(request: StructuredRequest<T>): StructuredResult<T> | null {
  if (request.prompt.length > MAX_PROMPT_CHARS || request.system.length > MAX_SYSTEM_CHARS) {
    return { ok: false, error: "provider_error", message: "Request exceeds the prompt size limit" };
  }
  if ((request.maxOutputTokens ?? 0) > MAX_OUTPUT_TOKENS) {
    return {
      ok: false,
      error: "provider_error",
      message: "Request exceeds the output token limit",
    };
  }
  return null;
}

/** Wraps a provider so every request passes `checkRequest` first. */
export function withRequestGuards(provider: AIProvider): AIProvider {
  return {
    name: provider.name,
    isMock: provider.isMock,
    async generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
      return checkRequest(request) ?? provider.generateStructured(request);
    },
  };
}
