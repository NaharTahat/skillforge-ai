-- Safety guard: the Assessment tables were unused Phase 1 placeholders and must be empty.
-- This migration replaces their placeholder columns, so it refuses to run if any row exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Assessment") OR EXISTS (SELECT 1 FROM "AssessmentQuestion") OR EXISTS (SELECT 1 FROM "AssessmentResult") THEN
    RAISE EXCEPTION 'ai_assessments migration aborted: Assessment tables are not empty';
  END IF;
END $$;
-- CreateEnum
CREATE TYPE "AssessmentSource" AS ENUM ('JOB_MATCH', 'CAREER_GOAL', 'SKILL', 'MIXED');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('TECHNICAL', 'CONCEPTUAL', 'PRACTICAL', 'MIXED');

-- CreateEnum
CREATE TYPE "AssessmentDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ADAPTIVE');

-- CreateEnum
CREATE TYPE "AssessmentFocus" AS ENUM ('CORE_CONCEPTS', 'PROBLEM_SOLVING', 'PRACTICAL_APPLICATION', 'TECHNICAL_KNOWLEDGE', 'REAL_WORLD_SCENARIOS', 'MIXED');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'GENERATING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssessmentStage" AS ENUM ('PREPARING', 'GENERATING', 'VALIDATING', 'FINALIZING');

-- CreateEnum
CREATE TYPE "AssessmentQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'SCENARIO', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "AssessmentQuestionSource" AS ENUM ('CV_ANALYSIS', 'JOB_MATCH', 'CAREER_GOAL', 'ROADMAP', 'SKILL_SELECTION');

-- CreateEnum
CREATE TYPE "AssessmentQuestionStatus" AS ENUM ('PENDING', 'ANSWERED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AssessmentAnswerStatus" AS ENUM ('SUBMITTED', 'EVALUATED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssessmentLevel" AS ENUM ('NEEDS_IMPROVEMENT', 'DEVELOPING', 'COMPETENT', 'STRONG');

-- DropForeignKey
ALTER TABLE "Assessment" DROP CONSTRAINT "Assessment_skillId_fkey";

-- DropForeignKey
ALTER TABLE "AssessmentResult" DROP CONSTRAINT "AssessmentResult_userId_fkey";

-- DropIndex
DROP INDEX "Assessment_skillId_idx";

-- DropIndex
DROP INDEX "Assessment_slug_key";

-- DropIndex
DROP INDEX "AssessmentResult_assessmentId_idx";

-- DropIndex
DROP INDEX "AssessmentResult_userId_idx";

-- AlterTable
ALTER TABLE "Assessment" DROP COLUMN "description",
DROP COLUMN "durationMinutes",
DROP COLUMN "isPublished",
DROP COLUMN "skillId",
DROP COLUMN "slug",
ADD COLUMN     "assessmentVersion" INTEGER,
ADD COLUMN     "careerGoal" "CareerGoal",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "cvAnalysisId" TEXT,
ADD COLUMN     "cvId" TEXT,
ADD COLUMN     "difficulty" "AssessmentDifficulty" NOT NULL,
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "focus" "AssessmentFocus" NOT NULL,
ADD COLUMN     "jobAnalysisId" TEXT,
ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "practiceOfId" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL,
ADD COLUMN     "questionCount" INTEGER NOT NULL,
ADD COLUMN     "roadmapId" TEXT,
ADD COLUMN     "skills" TEXT[],
ADD COLUMN     "sourceType" "AssessmentSource" NOT NULL,
ADD COLUMN     "stage" "AssessmentStage" NOT NULL DEFAULT 'PREPARING',
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "timeLimitMinutes" INTEGER,
ADD COLUMN     "type" "AssessmentType" NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AssessmentQuestion" DROP COLUMN "answerKey",
DROP COLUMN "language",
DROP COLUMN "points",
DROP COLUMN "starterCode",
ADD COLUMN     "correctAnswer" TEXT,
ADD COLUMN     "expectedPoints" TEXT[],
ADD COLUMN     "explanation" TEXT NOT NULL,
ADD COLUMN     "scenario" TEXT,
ADD COLUMN     "skill" TEXT NOT NULL,
ADD COLUMN     "source" "AssessmentQuestionSource" NOT NULL,
ADD COLUMN     "sourceReason" TEXT NOT NULL,
ADD COLUMN     "status" "AssessmentQuestionStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "type",
ADD COLUMN     "type" "AssessmentQuestionType" NOT NULL;

-- AlterTable
ALTER TABLE "AssessmentResult" DROP COLUMN "answers",
DROP COLUMN "completedAt",
DROP COLUMN "score",
DROP COLUMN "startedAt",
DROP COLUMN "userId",
ADD COLUMN     "categoryBreakdown" JSONB NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "improvementAreas" JSONB NOT NULL,
ADD COLUMN     "insightsSource" TEXT NOT NULL,
ADD COLUMN     "maxScore" INTEGER NOT NULL,
ADD COLUMN     "percentage" INTEGER NOT NULL,
ADD COLUMN     "rawScore" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "reviewTopics" JSONB NOT NULL,
ADD COLUMN     "skillBreakdown" JSONB NOT NULL,
ADD COLUMN     "strengths" JSONB NOT NULL,
ADD COLUMN     "timeExpired" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "level",
ADD COLUMN     "level" "AssessmentLevel" NOT NULL,
DROP COLUMN "recommendations",
ADD COLUMN     "recommendations" JSONB NOT NULL;

-- DropEnum
DROP TYPE "QuestionType";

-- CreateTable
CREATE TABLE "AssessmentAnswer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "status" "AssessmentAnswerStatus" NOT NULL DEFAULT 'SUBMITTED',
    "isCorrect" BOOLEAN,
    "score" DOUBLE PRECISION,
    "accuracy" INTEGER,
    "relevance" INTEGER,
    "completeness" INTEGER,
    "clarity" INTEGER,
    "technicalDepth" INTEGER,
    "feedback" TEXT,
    "errorCode" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "AssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAnswer_questionId_key" ON "AssessmentAnswer"("questionId");

-- CreateIndex
CREATE INDEX "Assessment_userId_createdAt_idx" ON "Assessment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Assessment_status_idx" ON "Assessment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentResult_assessmentId_key" ON "AssessmentResult"("assessmentId");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "CV"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_cvAnalysisId_fkey" FOREIGN KEY ("cvAnalysisId") REFERENCES "CvAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_jobAnalysisId_fkey" FOREIGN KEY ("jobAnalysisId") REFERENCES "JobAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_practiceOfId_fkey" FOREIGN KEY ("practiceOfId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
