import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertValidStorageKey, StorageError, type FileStorage } from "./storage";

/**
 * Local filesystem driver for development and single-server deployments.
 * Files live under a private root (default `.data/uploads`) that is never
 * served by Next.js. Object keys are validated and resolved inside the root.
 */
export class LocalFileStorage implements FileStorage {
  readonly driver = "local";
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = path.resolve(rootDir);
    const publicDir = path.resolve("public");
    if (this.root === publicDir || this.root.startsWith(publicDir + path.sep)) {
      throw new Error("Local storage must not be inside public/");
    }
  }

  /** Resolves a key to an absolute path, refusing anything outside the root. */
  resolvePath(key: string): string {
    assertValidStorageKey(key);
    const target = path.resolve(this.root, ...key.split("/"));
    if (!target.startsWith(this.root + path.sep)) {
      throw new StorageError("INVALID_KEY", "Invalid storage key");
    }
    return target;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const target = this.resolvePath(key);
    try {
      await mkdir(path.dirname(target), { recursive: true });
      // "wx": never overwrite an existing object.
      await writeFile(target, data, { flag: "wx", mode: 0o600 });
    } catch {
      throw new StorageError("IO", "Could not store file");
    }
  }

  async get(key: string): Promise<Uint8Array> {
    const target = this.resolvePath(key);
    try {
      return new Uint8Array(await readFile(target));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      throw new StorageError(code === "ENOENT" ? "NOT_FOUND" : "IO", "Could not read file");
    }
  }

  async delete(key: string): Promise<void> {
    const target = this.resolvePath(key);
    try {
      await rm(target, { force: true });
    } catch {
      throw new StorageError("IO", "Could not delete file");
    }
  }
}
