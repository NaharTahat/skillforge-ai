import { z } from "zod";

/** Serializable result returned by server actions to client forms. */
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string> };

export function validationFailure(error: z.ZodError): ActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(z.flattenError(error).fieldErrors)) {
    const first = (messages as string[] | undefined)?.[0];
    if (first) fieldErrors[field] = first;
  }
  return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
}
