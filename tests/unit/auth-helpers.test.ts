import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { computeProfileCompletion } from "@/lib/profile/completion";
import { createRateLimiter } from "@/lib/security/rate-limit";

describe("safeRedirectPath", () => {
  it.each(["/dashboard", "/dashboard/profile?tab=1"])("allows same-origin path %s", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "dashboard", "", undefined, 42])(
    "rejects %s",
    (value) => {
      expect(safeRedirectPath(value)).toBe("/dashboard");
    },
  );
});

describe("getAuthErrorMessage", () => {
  it("maps known codes and falls back for unknown ones", () => {
    expect(getAuthErrorMessage("CredentialsSignin").title).toBe("Invalid email or password");
    expect(getAuthErrorMessage("<script>").title).toBe("Something went wrong");
    expect(getAuthErrorMessage(null).title).toBe("Something went wrong");
  });
});

describe("computeProfileCompletion", () => {
  const empty = {
    firstName: "",
    lastName: "",
    displayName: "",
    image: "",
    careerGoal: "",
    experienceLevel: "",
    location: "",
    bio: "",
  };

  it("reports 0% and every field missing for an empty profile", () => {
    const result = computeProfileCompletion(empty);
    expect(result).toMatchObject({ percent: 0, completed: 0, total: 8 });
    expect(result.missing).toHaveLength(8);
  });

  it("counts only real, non-blank values", () => {
    const result = computeProfileCompletion({
      ...empty,
      firstName: "Ada",
      lastName: "Lovelace",
      displayName: "Ada Lovelace",
      careerGoal: "AI_ENGINEER",
      bio: "   ",
    });
    expect(result.percent).toBe(50);
    expect(result.missing).toEqual(["Profile image", "Experience level", "Location", "Bio"]);
  });
});

describe("createRateLimiter", () => {
  it("blocks after the limit and resets after the window", async () => {
    const check = createRateLimiter({ name: "test-basic", limit: 2, windowMs: 1000 });
    expect((await check("k", 0)).ok).toBe(true);
    expect((await check("k", 10)).ok).toBe(true);
    expect(await check("k", 20)).toEqual({ ok: false, retryAfterSeconds: 1 });
    expect((await check("other", 20)).ok).toBe(true);
    expect((await check("k", 1001)).ok).toBe(true);
  });
});
