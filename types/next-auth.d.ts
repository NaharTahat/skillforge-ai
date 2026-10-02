import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    /** Unix seconds when the user signed in (used to invalidate old sessions). */
    authTime?: number;
    /** Random id of this sign-in session (revoked on sign-out). */
    sid?: string;
  }

  interface User {
    firstName?: string | null;
    lastName?: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    authTime?: number;
    sid?: string;
  }
}
