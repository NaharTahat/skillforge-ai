import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authConfig } from "@/lib/auth/config";
import { verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";
import { isGoogleAuthEnabled } from "@/lib/auth/providers";
import { revokeSession } from "@/lib/auth/revocation";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validations/auth";

const credentials = Credentials({
  credentials: { email: {}, password: {} },
  async authorize(raw) {
    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) return null;

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, image: true, passwordHash: true },
    });

    // OAuth-only accounts have no password; treat exactly like an unknown email.
    if (!user?.passwordHash) return verifyAgainstDummy(password).then(() => null);
    if (!(await verifyPassword(password, user.passwordHash))) return null;

    // Never return the hash — only these fields reach the JWT callback.
    return { id: user.id, name: user.name, email: user.email, image: user.image };
  },
});

const providers: Provider[] = [credentials];

if (isGoogleAuthEnabled()) {
  providers.push(
    Google({
      // Reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET. No automatic account linking by
      // email: an existing email must sign in with its original method.
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email.toLowerCase(),
          image: profile.picture,
          firstName: profile.given_name ?? null,
          lastName: profile.family_name ?? null,
        };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers,
  events: {
    // JWT sessions are stateless: record the session id so a copy of the cookie
    // can't be used after sign-out.
    async signOut(message) {
      if ("token" in message && message.token) {
        await revokeSession(message.token.sid, message.token.exp);
      }
    },
  },
  logger: {
    // Wrong passwords are expected traffic, not server errors. Other auth errors
    // are logged by name/message only — never request bodies or credentials.
    error(error) {
      if (error.name === "CredentialsSignin") return;
      console.error(`[auth] ${error.name}: ${error.message}`);
    },
  },
});
