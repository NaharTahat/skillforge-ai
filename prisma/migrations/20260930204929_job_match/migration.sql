/*
  Warnings:

  - Added the required column `provider` to the `JobAnalysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `JobAnalysis` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Job_userId_idx";

-- DropIndex
DROP INDEX "JobAnalysis_jobId_idx";

-- AlterTable
ALTER TABLE "Job" ALTER COLUMN "title" DROP NOT NULL;

-- AlterTable
ALTER TABLE "JobAnalysis" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL,
ADD COLUMN     "scoringVersion" INTEGER,
ADD COLUMN     "stage" "AnalysisStage" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "matchScore" DROP NOT NULL,
ALTER COLUMN "result" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Job_userId_createdAt_idx" ON "Job"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "JobAnalysis_jobId_createdAt_idx" ON "JobAnalysis"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "JobAnalysis_status_idx" ON "JobAnalysis"("status");
