import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth/auth";
import { isSessionRevoked } from "@/lib/auth/revocation";
import { prisma } from "@/lib/db/prisma";

/**
 * The authenticated user, loaded from the database.
 *
 * DATA ISOLATION RULE: every query for user-owned data must be scoped with the
 * `id` returned here (e.g. `where: { userId: user.id }`). Never accept a user id
 * from the browser (params, body, search params) as the owner of a record.
 */
export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
  /** Whether the account can sign in with a password (vs. OAuth only). */
  hasPassword: boolean;
};

type SessionState =
  | { status: "anonymous" }
  | { status: "invalid" } // cookie present but user deleted or password changed since
  | { status: "authenticated"; user: CurrentUser };

/** Memoized per request, so layouts, pages and actions share one lookup. */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { status: "anonymous" };

  const [record, revoked] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        image: true,
        passwordHash: true,
        passwordChangedAt: true,
      },
    }),
    // A signed-out session whose cookie was copied before logout.
    isSessionRevoked(session.sid),
  ]);
  if (!record || revoked) return { status: "invalid" };

  const signedInAt = session.authTime ?? 0;
  // Whole seconds on both sides, so signing in within the same second as a reset still works.
  const changedAt = record.passwordChangedAt
    ? Math.floor(record.passwordChangedAt.getTime() / 1000)
    : 0;
  if (changedAt > signedInAt) {
    return { status: "invalid" };
  }

  // Explicit fields: the hash never leaves this function.
  return {
    status: "authenticated",
    user: {
      id: record.id,
      email: record.email,
      name: record.name,
      firstName: record.firstName,
      lastName: record.lastName,
      image: record.image,
      hasPassword: record.passwordHash !== null,
    },
  };
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const state = await getSessionState();
  return state.status === "authenticated" ? state.user : null;
}

/** For pages, layouts and server actions that require a signed-in user. */
export async function requireUser(): Promise<CurrentUser> {
  const state = await getSessionState();
  if (state.status === "authenticated") return state.user;
  // A stale cookie can't be cleared during render, so send invalid sessions to a
  // page that signs out explicitly (avoids a /login ⇄ /dashboard redirect loop).
  redirect(state.status === "invalid" ? "/auth/session-expired" : "/login");
}

export function displayNameOf(
  user: Pick<CurrentUser, "name" | "firstName" | "lastName" | "email">,
) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return user.name || full || user.email;
}
