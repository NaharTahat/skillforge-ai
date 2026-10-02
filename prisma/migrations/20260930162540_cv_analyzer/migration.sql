/*
  Warnings:

  - You are about to drop the column `status` on the `CV` table. All the data in the column will be lost.
  - Made the column `extractedText` on table `CV` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `provider` to the `CvAnalysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `CvAnalysis` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnalysisStage" AS ENUM ('QUEUED', 'ANALYZING', 'FINALIZING');

-- DropIndex
DROP INDEX "CV_userId_idx";

-- DropIndex
DROP INDEX "CvAnalysis_cvId_idx";

-- AlterTable
ALTER TABLE "CV" DROP COLUMN "status",
ADD COLUMN     "pageCount" INTEGER,
ADD COLUMN     "textTruncated" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "extractedText" SET NOT NULL;

-- AlterTable
ALTER TABLE "CvAnalysis" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL,
ADD COLUMN     "scoringVersion" INTEGER,
ADD COLUMN     "stage" "AnalysisStage" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "score" DROP NOT NULL,
ALTER COLUMN "result" DROP NOT NULL;

-- DropEnum
DROP TYPE "CvStatus";

-- CreateIndex
CREATE INDEX "CV_userId_createdAt_idx" ON "CV"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CvAnalysis_cvId_createdAt_idx" ON "CvAnalysis"("cvId", "createdAt");

-- CreateIndex
CREATE INDEX "CvAnalysis_status_idx" ON "CvAnalysis"("status");
