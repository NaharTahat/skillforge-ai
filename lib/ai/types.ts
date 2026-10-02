import type { z } from "zod";

/**
 * Provider-agnostic contract for structured AI generation.
 *
 * Feature services (cv-analyzer, job-match, …) depend only on this interface,
 * so the underlying provider can be swapped via the AI_PROVIDER env var
 * (see getAIProvider in ./provider). Implementations must validate output
 * against `schema` and never return unvalidated model text.
 *
 * Privacy: requests carry user documents. Implementations must not log
 * `system`, `prompt` or `input`, and error messages must not echo them.
 */
export interface AIProvider {
  readonly name: string;
  /** True for development/test providers; their output is labelled as non-AI in the UI. */
  readonly isMock: boolean;
  generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>>;
}

export type StructuredRequest<T> = {
  /** Stable task identifier, e.g. "cv-analysis". */
  task: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxOutputTokens?: number;
  /**
   * The structured input the prompt was built from. Real providers ignore it;
   * the mock provider derives its deterministic output from it.
   */
  input?: unknown;
};

export type AIErrorKind =
  "invalid_output" | "rate_limited" | "timeout" | "unavailable" | "refused" | "provider_error";

export type StructuredResult<T> =
  | { ok: true; data: T; model: string }
  /** `message` is for server diagnostics only; never shown to users. */
  | { ok: false; error: AIErrorKind; message: string };
