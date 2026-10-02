import "server-only";
import { randomUUID } from "node:crypto";
import { getEnv } from "@/lib/env";
import { LocalFileStorage } from "./local";
import type { FileStorage } from "./storage";

let instance: FileStorage | undefined;

/** Storage factory — callers depend on FileStorage, never on a concrete driver. */
export function getStorage(): FileStorage {
  if (instance) return instance;
  const env = getEnv();
  switch (env.STORAGE_DRIVER) {
    case "local":
      instance = new LocalFileStorage(env.STORAGE_LOCAL_DIR);
      break;
  }
  return instance;
}

/** Server-generated key. The user's original filename is never part of it. */
export function cvStorageKey(userId: string): string {
  return `cv/${userId.replace(/[^a-z0-9]/gi, "")}/${randomUUID()}`;
}

export { StorageError, type FileStorage } from "./storage";
