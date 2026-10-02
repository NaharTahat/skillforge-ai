import type { NextAuthConfig } from "next-auth";

/**
 * Base Auth.js config with no database or Node-only imports, so it can be
 * shared by the full instance (lib/auth/auth.ts) and the route proxy.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  // Credentials sign-in requires JWT sessions. Every protected server request
  // still re-checks the user in the database (see lib/auth/session.ts).
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present on the sign-in request.
      if (user?.id) {
        token.sub = user.id;
        token.authTime = Math.floor(Date.now() / 1000);
        // Random per-sign-in id, so this one session can be revoked on sign-out.
        token.sid = crypto.randomUUID();
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.authTime = token.authTime;
      session.sid = token.sid;
      return session;
    },
  },
} satisfies NextAuthConfig;
