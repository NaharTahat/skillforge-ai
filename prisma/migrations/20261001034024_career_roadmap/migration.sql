-- CreateEnum
CREATE TYPE "RoadmapSource" AS ENUM ('JOB_MATCH', 'CAREER_GOAL');

-- CreateEnum
CREATE TYPE "RoadmapTaskCategory" AS ENUM ('FUNDAMENTALS', 'TECHNICAL_SKILL', 'TOOL', 'PROJECT', 'PORTFOLIO', 'INTERVIEW_PREPARATION', 'CAREER_PREPARATION');

-- CreateEnum
CREATE TYPE "RoadmapPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- AlterEnum
BEGIN;
CREATE TYPE "RoadmapItemStatus_new" AS ENUM ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED');
ALTER TABLE "public"."RoadmapItem" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "RoadmapItem" ALTER COLUMN "status" TYPE "RoadmapItemStatus_new" USING ("status"::text::"RoadmapItemStatus_new");
ALTER TYPE "RoadmapItemStatus" RENAME TO "RoadmapItemStatus_old";
ALTER TYPE "RoadmapItemStatus_new" RENAME TO "RoadmapItemStatus";
DROP TYPE "public"."RoadmapItemStatus_old";
ALTER TABLE "RoadmapItem" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
COMMIT;

-- DropIndex
DROP INDEX "Roadmap_userId_idx";

-- AlterTable
ALTER TABLE "Roadmap" DROP COLUMN "description",
DROP COLUMN "isActive",
ADD COLUMN     "careerGoal" "CareerGoal",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "cvAnalysisId" TEXT,
ADD COLUMN     "cvId" TEXT,
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "jobAnalysisId" TEXT,
ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL,
ADD COLUMN     "regeneratedFromId" TEXT,
ADD COLUMN     "result" JSONB,
ADD COLUMN     "roadmapVersion" INTEGER,
ADD COLUMN     "sourceType" "RoadmapSource" NOT NULL,
ADD COLUMN     "stage" "AnalysisStage" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "timeframeWeeks" INTEGER;

-- AlterTable
ALTER TABLE "RoadmapItem" DROP COLUMN "difficulty",
ADD COLUMN     "category" "RoadmapTaskCategory" NOT NULL,
ADD COLUMN     "dependsOn" TEXT[],
ADD COLUMN     "estimatedDays" INTEGER NOT NULL,
ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "phaseOrder" INTEGER NOT NULL,
ADD COLUMN     "practicalOutcome" TEXT NOT NULL,
ADD COLUMN     "prerequisites" TEXT[],
ADD COLUMN     "priority" "RoadmapPriority" NOT NULL,
ADD COLUMN     "skill" TEXT NOT NULL,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "verificationMethod" TEXT NOT NULL,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';

-- CreateIndex
CREATE INDEX "Roadmap_userId_createdAt_idx" ON "Roadmap"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Roadmap_status_idx" ON "Roadmap"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapItem_roadmapId_key_key" ON "RoadmapItem"("roadmapId", "key");

-- AddForeignKey
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "CV"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_cvAnalysisId_fkey" FOREIGN KEY ("cvAnalysisId") REFERENCES "CvAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_jobAnalysisId_fkey" FOREIGN KEY ("jobAnalysisId") REFERENCES "JobAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_regeneratedFromId_fkey" FOREIGN KEY ("regeneratedFromId") REFERENCES "Roadmap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

