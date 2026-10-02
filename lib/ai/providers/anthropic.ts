import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { AIErrorKind, AIProvider, StructuredRequest, StructuredResult } from "../types";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

/**
 * Claude via the official Anthropic SDK, using structured outputs
 * (`messages.parse` + a Zod output format). Output is re-validated by callers.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly isMock = false;
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string = DEFAULT_ANTHROPIC_MODEL,
    private readonly timeoutMs: number = 120_000,
  ) {
    // One SDK retry for transient 429/5xx/connection errors.
    this.client = new Anthropic({ apiKey, maxRetries: 1, timeout: timeoutMs });
  }

  async generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    try {
      const response = await this.client.beta.messages.parse(
        {
          model: this.model,
          max_tokens: request.maxOutputTokens ?? 16_000,
          system: request.system,
          messages: [{ role: "user", content: request.prompt }],
          // Opus 5.5 always thinks; effort is the depth control (its default is medium).
          output_config: { effort: "medium", format: betaZodOutputFormat(request.schema) },
          // On a safety-classifier refusal, the API re-runs the request on a fallback model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        },
        { timeout: this.timeoutMs },
      );

      if (response.stop_reason === "refusal") {
        return { ok: false, error: "refused", message: "Model declined the request" };
      }
      if (response.stop_reason === "max_tokens") {
        return { ok: false, error: "invalid_output", message: "Output truncated at max_tokens" };
      }
      if (response.parsed_output == null) {
        return { ok: false, error: "invalid_output", message: "Output did not match schema" };
      }
      return { ok: true, data: response.parsed_output as T, model: response.model };
    } catch (error) {
      return { ok: false, ...classifyError(error) };
    }
  }
}

/** Typed SDK errors, most specific first. Messages carry no request content. */
function classifyError(error: unknown): { error: AIErrorKind; message: string } {
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return { error: "timeout", message: "Request timed out" };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { error: "rate_limited", message: "Rate limited (429)" };
  }
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return { error: "unavailable", message: `Credentials rejected (${error.status})` };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { error: "provider_error", message: "Bad request (400)" };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { error: "unavailable", message: "Connection failed" };
  }
  if (error instanceof Anthropic.APIError) {
    return { error: "unavailable", message: `API error (${error.status ?? "unknown"})` };
  }
  return { error: "invalid_output", message: "Response could not be parsed" };
}
