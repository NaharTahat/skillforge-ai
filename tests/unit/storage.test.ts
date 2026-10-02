import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { LocalFileStorage } from "@/lib/storage/local";
import { StorageError } from "@/lib/storage/storage";

const root = mkdtempSync(path.join(tmpdir(), "skillforge-storage-"));
const storage = new LocalFileStorage(root);

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("LocalFileStorage", () => {
  it("stores, reads and deletes private objects", async () => {
    const data = new Uint8Array([1, 2, 3]);
    await storage.put("cv/user1/abc-123", data);
    expect(await storage.get("cv/user1/abc-123")).toEqual(data);
    await storage.delete("cv/user1/abc-123");
    await expect(storage.get("cv/user1/abc-123")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(storage.delete("cv/user1/abc-123")).resolves.toBeUndefined();
  });

  it("never overwrites an existing object", async () => {
    await storage.put("cv/user1/once", new Uint8Array([1]));
    await expect(storage.put("cv/user1/once", new Uint8Array([2]))).rejects.toBeInstanceOf(
      StorageError,
    );
  });

  it.each([
    "../escape",
    "cv/../../etc/passwd",
    "/etc/passwd",
    "C:\\Windows\\win.ini",
    "cv\\..\\x",
    "cv//double",
    "cv/file.pdf",
    "",
  ])("rejects unsafe key %j", (key) => {
    expect(() => storage.resolvePath(key)).toThrow(StorageError);
  });

  it("refuses a storage root inside public/", () => {
    expect(() => new LocalFileStorage("public/uploads")).toThrow(/public/);
  });
});
