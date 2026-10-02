import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { profileSchema } from "@/lib/validations/profile";

const validRegistration = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "  Ada@Example.COM ",
  password: "Analytical1",
  confirmPassword: "Analytical1",
};

function fieldErrors(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((issue) => issue.path.join(".")) ?? [];
}

describe("registerSchema", () => {
  it("accepts a valid registration and normalizes the email", () => {
    const result = registerSchema.safeParse(validRegistration);
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("ada@example.com");
  });

  it("requires names and a valid email", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      firstName: " ",
      lastName: "",
      email: "not-an-email",
    });
    expect(fieldErrors(result)).toEqual(expect.arrayContaining(["firstName", "lastName", "email"]));
  });

  it.each([
    ["too short", "Ab1"],
    ["no uppercase", "lowercase1"],
    ["no lowercase", "UPPERCASE1"],
    ["no number", "NoNumbersHere"],
  ])("rejects a weak password (%s)", (_, password) => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password,
      confirmPassword: password,
    });
    expect(fieldErrors(result)).toContain("password");
  });

  it("rejects mismatched confirmation", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      confirmPassword: "Analytical2",
    });
    expect(fieldErrors(result)).toEqual(["confirmPassword"]);
  });
});

describe("loginSchema", () => {
  it("requires both fields but does not apply strength rules", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(fieldErrors(loginSchema.safeParse({ email: "", password: "" }))).toEqual([
      "email",
      "password",
    ]);
  });
});

describe("resetPasswordSchema", () => {
  it("applies strength and confirmation rules", () => {
    const token = "t".repeat(43);
    expect(
      resetPasswordSchema.safeParse({
        token,
        password: "Str0ngPass",
        confirmPassword: "Str0ngPass",
      }).success,
    ).toBe(true);
    expect(
      fieldErrors(
        resetPasswordSchema.safeParse({ token, password: "weak", confirmPassword: "weak" }),
      ),
    ).toContain("password");
  });
});

describe("profileSchema", () => {
  const base = {
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: "",
    email: "ada@example.com",
    image: "",
    careerGoal: "",
    experienceLevel: "",
    location: "",
    bio: "",
  };

  it("turns empty optional fields into null", () => {
    const result = profileSchema.parse(base);
    expect(result).toMatchObject({ displayName: null, image: null, careerGoal: null, bio: null });
  });

  it("accepts only controlled career goals and experience levels", () => {
    expect(
      profileSchema.safeParse({ ...base, careerGoal: "AI_ENGINEER", experienceLevel: "MID" })
        .success,
    ).toBe(true);
    expect(fieldErrors(profileSchema.safeParse({ ...base, careerGoal: "ASTRONAUT" }))).toContain(
      "careerGoal",
    );
    expect(fieldErrors(profileSchema.safeParse({ ...base, experienceLevel: "LEAD" }))).toContain(
      "experienceLevel",
    );
  });

  it("only allows https image URLs", () => {
    expect(
      fieldErrors(profileSchema.safeParse({ ...base, image: "javascript:alert(1)" })),
    ).toContain("image");
    expect(
      fieldErrors(profileSchema.safeParse({ ...base, image: "http://x.test/a.png" })),
    ).toContain("image");
    expect(profileSchema.safeParse({ ...base, image: "https://x.test/a.png" }).success).toBe(true);
  });

  it("limits bio length", () => {
    expect(fieldErrors(profileSchema.safeParse({ ...base, bio: "x".repeat(601) }))).toContain(
      "bio",
    );
  });
});
