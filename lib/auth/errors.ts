/**
 * User-facing messages for Auth.js error codes (see /auth/error and /login).
 * Deliberately vague where detail would leak account information.
 */
const messages: Record<string, { title: string; description: string }> = {
  CredentialsSignin: {
    title: "Invalid email or password",
    description: "Check your details and try again.",
  },
  OAuthAccountNotLinked: {
    title: "Use your original sign-in method",
    description:
      "An account with this email already exists. Sign in with the method you used originally.",
  },
  OAuthSignin: {
    title: "Couldn't start sign-in",
    description: "We couldn't connect to the sign-in provider. Please try again.",
  },
  OAuthCallback: {
    title: "Sign-in was not completed",
    description: "The sign-in provider returned an error. Please try again.",
  },
  OAuthCallbackError: {
    title: "Sign-in was not completed",
    description: "The sign-in provider returned an error. Please try again.",
  },
  AccessDenied: {
    title: "Access denied",
    description: "You don't have permission to sign in with this account.",
  },
  Verification: {
    title: "Link expired",
    description: "This sign-in link is no longer valid. Request a new one.",
  },
  SessionRequired: {
    title: "Please sign in",
    description: "You need to be signed in to view that page.",
  },
  Configuration: {
    title: "Sign-in is temporarily unavailable",
    description: "Something is misconfigured on our side. Please try again later.",
  },
};

const fallback = {
  title: "Something went wrong",
  description: "We couldn't complete sign-in. Please try again.",
};

export function getAuthErrorMessage(code: string | null | undefined) {
  return (code && messages[code]) || fallback;
}
