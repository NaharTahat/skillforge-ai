import "server-only";
import { after } from "next/server";
import { analyzeCv } from "@/lib/ai/cv-analyzer";
import { AIConfigurationError, getAIProvider } from "@/lib/ai/provider";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";
import { createKeyedLock } from "@/lib/security/keyed-lock";
import { cvStorageKey, getStorage } from "@/lib/storage";
import { CvError } from "./errors";
import { extractCvText } from "./extractor";
import { validateCvFile } from "./file-validation";

/**
 * CV pipeline: ingest (validate → extract → store → record) and analysis runs.
 * Every entry point takes the owner's id from the caller's session and scopes
 * all queries by it. No function here logs CV text, prompts or file bytes.
 */

const ACTIVE = ["PENDING", "PROCESSING"] as const;

/** An analysis still "running" after this long was lost (crash/restart). */
function staleAfterMs() {
  return getEnv().AI_TIMEOUT_MS * 2 + 60_000;
}

export function maxUploadBytes() {
  return getEnv().MAX_UPLOAD_SIZE_MB * 1024 * 1024;
}

// ─── Ingest ──────────────────────────────────────────────────────────────────

export async function ingestCvUpload(input: {
  userId: string;
  fileName: string;
  declaredMimeType: string;
  bytes: Uint8Array;
}): Promise<{ cvId: string; analysisId: string }> {
  const validation = validateCvFile({
    fileName: input.fileName,
    declaredMimeType: input.declaredMimeType,
    bytes: input.bytes,
    maxBytes: maxUploadBytes(),
  });
  if (!validation.ok) throw new CvError(validation.code);

  // Extract before storing: unusable files (scans, corrupt, empty) are never kept.
  const extraction = await extractCvText(input.bytes, validation.kind);

  const storage = getStorage();
  const storageKey = cvStorageKey(input.userId);
  try {
    await storage.put(storageKey, input.bytes, validation.mimeType);
  } catch {
    throw new CvError("STORAGE_ERROR");
  }

  let created: { id: string; analyses: { id: string }[] };
  try {
    created = await prisma.cV.create({
      data: {
        userId: input.userId,
        // Display only; trimmed and length-limited. Never used as a path.
        fileName: input.fileName.trim().slice(0, 200) || `cv.${validation.kind}`,
        mimeType: validation.mimeType,
        fileSize: input.bytes.length,
        storageKey,
        extractedText: extraction.text,
        textTruncated: extraction.metadata.truncated,
        pageCount: extraction.metadata.pageCount,
        analyses: { create: { provider: providerName() } },
      },
      select: { id: true, analyses: { select: { id: true } } },
    });
  } catch {
    await storage.delete(storageKey).catch(() => undefined);
    throw new CvError("DATABASE_ERROR");
  }

  const analysisId = created.analyses[0]!.id;
  scheduleAnalysis(analysisId);
  return { cvId: created.id, analysisId };
}

function providerName(): string {
  return getEnv().AI_PROVIDER;
}

// ─── Analysis requests ───────────────────────────────────────────────────────

// Serializes requests per CV within this process so double clicks can't start
// two runs. (Per-instance only; see README on horizontal scaling.)
const withCvLock = createKeyedLock();

/**
 * Starts a new analysis of the user's CV, or returns the one already running.
 * Returns null if the CV doesn't exist or isn't owned by the user.
 */
export async function requestAnalysis(
  userId: string,
  cvId: string,
): Promise<{ analysisId: string; reused: boolean } | null> {
  return withCvLock(cvId, async () => {
    const cv = await prisma.cV.findFirst({ where: { id: cvId, userId }, select: { id: true } });
    if (!cv) return null;

    await expireStaleAnalyses({ cvId });
    const active = await prisma.cvAnalysis.findFirst({
      where: { cvId, status: { in: [...ACTIVE] } },
      select: { id: true },
    });
    if (active) return { analysisId: active.id, reused: true };

    const analysis = await prisma.cvAnalysis.create({
      data: { cvId, provider: providerName() },
      select: { id: true },
    });
    scheduleAnalysis(analysis.id);
    return { analysisId: analysis.id, reused: false };
  });
}

/** Runs after the response is sent; the client follows progress by polling. */
function scheduleAnalysis(analysisId: string) {
  after(() => runAnalysis(analysisId));
}

export async function runAnalysis(analysisId: string): Promise<void> {
  // Claim atomically: only a PENDING analysis can start (no double runs).
  const claimed = await prisma.cvAnalysis.updateMany({
    where: { id: analysisId, status: "PENDING" },
    data: { status: "PROCESSING", stage: "ANALYZING", startedAt: new Date() },
  });
  if (claimed.count === 0) return;

  try {
    const analysis = await prisma.cvAnalysis.findUniqueOrThrow({
      where: { id: analysisId },
      select: { cv: { select: { extractedText: true, textTruncated: true } } },
    });
    const { extractedText, textTruncated } = analysis.cv;

    const outcome = await analyzeCv(
      {
        cvText: extractedText,
        truncated: textTruncated,
        wordCount: extractedText.split(/\s+/).filter(Boolean).length,
      },
      getAIProvider(),
    );

    await prisma.cvAnalysis.update({
      where: { id: analysisId },
      data: { stage: "FINALIZING" },
    });
    await prisma.cvAnalysis.update({
      where: { id: analysisId },
      data: {
        status: "COMPLETED",
        score: outcome.report.score.overall,
        result: outcome.report,
        provider: outcome.provider,
        model: outcome.model,
        scoringVersion: outcome.report.score.version,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    const code =
      error instanceof CvError
        ? error.code
        : error instanceof AIConfigurationError
          ? "AI_UNAVAILABLE"
          : "UNKNOWN";
    // Code and internal message only — never CV content or provider payloads.
    console.error(`[cv] analysis ${analysisId} failed: ${code}`);
    await prisma.cvAnalysis
      .update({
        where: { id: analysisId },
        data: { status: "FAILED", errorCode: code, completedAt: new Date() },
      })
      .catch(() => undefined);
  }
}

/** Marks analyses that can no longer finish (server restarted mid-run) as failed. */
export async function expireStaleAnalyses(scope: { cvId: string } | { userId: string }) {
  await prisma.cvAnalysis.updateMany({
    where: {
      status: { in: [...ACTIVE] },
      updatedAt: { lt: new Date(Date.now() - staleAfterMs()) },
      ...("cvId" in scope ? { cvId: scope.cvId } : { cv: { userId: scope.userId } }),
    },
    data: { status: "FAILED", errorCode: "ANALYSIS_INTERRUPTED", completedAt: new Date() },
  });
}

// ─── Delete ──────────────────────────────────────────────────────────────────

/** Deletes the user's CV, its analyses (cascade) and its stored file. */
export async function deleteCv(userId: string, cvId: string): Promise<boolean> {
  const cv = await prisma.cV.findFirst({
    where: { id: cvId, userId },
    select: { id: true, storageKey: true },
  });
  if (!cv) return false;

  // Database first: a failed file delete leaves an orphaned private file,
  // never a record pointing at a missing file.
  await prisma.cV.delete({ where: { id: cv.id } });
  await getStorage()
    .delete(cv.storageKey)
    .catch(() => console.error(`[cv] stored file for ${cv.id} could not be deleted`));
  return true;
}
