import "server-only";
import { getEnv } from "@/lib/env";
import { withRequestGuards } from "./guard";
import { AnthropicProvider } from "./providers/anthropic";
import { MockAIProvider } from "./providers/mock";
import type { AIProvider } from "./types";

export class AIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigurationError";
  }
}

let instance: AIProvider | undefined;

/**
 * The only place that knows about concrete providers. Everything else depends
 * on the AIProvider interface. Selected by AI_PROVIDER; keys stay server-side.
 */
export function getAIProvider(): AIProvider {
  if (instance) return instance;
  const env = getEnv();

  switch (env.AI_PROVIDER) {
    case "anthropic":
      if (!env.AI_API_KEY) throw new AIConfigurationError("AI_API_KEY is not set");
      instance = withRequestGuards(
        new AnthropicProvider(env.AI_API_KEY, env.AI_MODEL, env.AI_TIMEOUT_MS),
      );
      break;
    case "mock":
      // A short delay keeps the staged progress UI observable in development.
      instance = withRequestGuards(new MockAIProvider(env.NODE_ENV === "test" ? 0 : 800));
      break;
  }
  return instance;
}
