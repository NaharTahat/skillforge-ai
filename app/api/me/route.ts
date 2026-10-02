import { getCurrentUser } from "@/lib/auth/session";

/**
 * The signed-in user's own public account fields. Identity comes only from
 * the session; any user id in the query string or body is ignored.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { id, email, name, firstName, lastName, image } = user;
  return Response.json(
    { id, email, name, firstName, lastName, image },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
