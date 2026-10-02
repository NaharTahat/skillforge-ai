-- Safety guard: the Interview tables were unused Phase 1 placeholders and must be empty.
-- This migration drops their placeholder columns, so it refuses to run if any row exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Interview") OR EXISTS (SELECT 1 FROM "InterviewQuestion") OR EXISTS (SELECT 1 FROM "InterviewAnswer") THEN
    RAISE EXCEPTION 'ai_interview migration aborted: Interview tables are not empty';
  END IF;
END $$;
-- CreateEnum
CREATE TYPE "InterviewSource" AS ENUM ('JOB_MATCH', 'CAREER_GOAL');

-- CreateEnum
CREATE TYPE "InterviewDifficulty" AS ENUM ('ENTRY', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "InterviewFocus" AS ENUM ('JOB_REQUIREMENTS', 'MISSING_SKILLS', 'TECHNICAL_DEPTH', 'BEHAVIORAL', 'PROJECTS', 'GENERAL');

-- CreateEnum
CREATE TYPE "InterviewStage" AS ENUM ('PREPARING', 'GENERATING', 'VALIDATING', 'FINALIZING');

-- CreateEnum
CREATE TYPE "InterviewQuestionKind" AS ENUM ('TECHNICAL', 'BEHAVIORAL', 'PROJECT', 'CV', 'JOB', 'GAP', 'HR');

-- CreateEnum
CREATE TYPE "InterviewQuestionSource" AS ENUM ('CV', 'CV_ANALYSIS', 'JOB_DESCRIPTION', 'JOB_MATCH', 'CAREER_GOAL', 'ROADMAP', 'GENERAL');

-- CreateEnum
CREATE TYPE "InterviewQuestionStatus" AS ENUM ('PENDING', 'ANSWERED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "InterviewAnswerStatus" AS ENUM ('EVALUATING', 'EVALUATED', 'FAILED');

-- CreateEnum
CREATE TYPE "InterviewVerdict" AS ENUM ('STRONG', 'PARTIAL', 'WEAK_EVIDENCE', 'INCORRECT');

-- AlterEnum
BEGIN;
CREATE TYPE "InterviewStatus_new" AS ENUM ('DRAFT', 'GENERATING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');
ALTER TABLE "public"."Interview" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Interview" ALTER COLUMN "status" TYPE "InterviewStatus_new" USING ("status"::text::"InterviewStatus_new");
ALTER TYPE "InterviewStatus" RENAME TO "InterviewStatus_old";
ALTER TYPE "InterviewStatus_new" RENAME TO "InterviewStatus";
DROP TYPE "public"."InterviewStatus_old";
ALTER TABLE "Interview" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
ALTER TYPE "InterviewType" ADD VALUE 'HR_GENERAL';

-- DropIndex
DROP INDEX "Interview_userId_idx";

-- DropIndex
DROP INDEX "InterviewQuestion_interviewId_position_key";

-- AlterTable
ALTER TABLE "Interview" DROP COLUMN "experienceLevel",
DROP COLUMN "jobTitle",
ADD COLUMN     "careerGoal" "CareerGoal",
ADD COLUMN     "cvAnalysisId" TEXT,
ADD COLUMN     "cvId" TEXT,
ADD COLUMN     "difficulty" "InterviewDifficulty" NOT NULL,
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "focus" "InterviewFocus" NOT NULL,
ADD COLUMN     "interviewVersion" INTEGER,
ADD COLUMN     "introduction" TEXT,
ADD COLUMN     "jobAnalysisId" TEXT,
ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "practiceOfId" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL,
ADD COLUMN     "questionCount" INTEGER NOT NULL,
ADD COLUMN     "result" JSONB,
ADD COLUMN     "roadmapId" TEXT,
ADD COLUMN     "sourceType" "InterviewSource" NOT NULL,
ADD COLUMN     "stage" "InterviewStage" NOT NULL DEFAULT 'PREPARING',
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "target" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "InterviewAnswer" DROP COLUMN "improvements",
ADD COLUMN     "accuracyNote" TEXT,
ADD COLUMN     "clarity" INTEGER,
ADD COLUMN     "communication" INTEGER,
ADD COLUMN     "completeness" INTEGER,
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "evaluatedAt" TIMESTAMP(3),
ADD COLUMN     "evidence" INTEGER,
ADD COLUMN     "improvement" TEXT,
ADD COLUMN     "missingPoints" TEXT[],
ADD COLUMN     "relevance" INTEGER,
ADD COLUMN     "status" "InterviewAnswerStatus" NOT NULL DEFAULT 'EVALUATING',
ADD COLUMN     "technicalAccuracy" INTEGER,
ADD COLUMN     "verdict" "InterviewVerdict";

-- AlterTable
ALTER TABLE "InterviewQuestion" DROP COLUMN "topic",
ADD COLUMN     "answeredAt" TIMESTAMP(3),
ADD COLUMN     "followUpIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kind" "InterviewQuestionKind" NOT NULL,
ADD COLUMN     "parentQuestionId" TEXT,
ADD COLUMN     "skill" TEXT,
ADD COLUMN     "source" "InterviewQuestionSource" NOT NULL,
ADD COLUMN     "sourceEvidence" TEXT,
ADD COLUMN     "sourceReason" TEXT NOT NULL,
ADD COLUMN     "status" "InterviewQuestionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Interview_userId_createdAt_idx" ON "Interview"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Interview_status_idx" ON "Interview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewQuestion_interviewId_position_followUpIndex_key" ON "InterviewQuestion"("interviewId", "position", "followUpIndex");

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "CV"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_cvAnalysisId_fkey" FOREIGN KEY ("cvAnalysisId") REFERENCES "CvAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_jobAnalysisId_fkey" FOREIGN KEY ("jobAnalysisId") REFERENCES "JobAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_practiceOfId_fkey" FOREIGN KEY ("practiceOfId") REFERENCES "Interview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_parentQuestionId_fkey" FOREIGN KEY ("parentQuestionId") REFERENCES "InterviewQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
