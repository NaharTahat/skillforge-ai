import { describe, expect, it } from "vitest";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("never stores the plaintext and verifies the correct password", async () => {
    const hash = await hashPassword("Correct-Horse-9");
    expect(hash).not.toContain("Correct-Horse-9");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Correct-Horse-9", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("Correct-Horse-9");
    expect(await verifyPassword("correct-horse-9", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    const [a, b] = await Promise.all([hashPassword("Same-Pass-1"), hashPassword("Same-Pass-1")]);
    expect(a).not.toBe(b);
  });

  it("rejects malformed or foreign hashes instead of throwing", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "$2b$10$abcdefghijklmnopqrstuv")).toBe(false);
    expect(await verifyPassword("x", "scrypt$1$1$1$c2FsdA==$dG9vc2hvcnQ=")).toBe(false);
  });

  it("dummy verification always fails", async () => {
    expect(await verifyAgainstDummy("anything")).toBe(false);
  });
});
