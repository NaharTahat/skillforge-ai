import type {
  AssessmentGenerationInput,
  OpenAnswerInput,
  ResultAnalysisInput,
} from "../assessment";
import type { AnswerEvaluationInput, InterviewGenerationInput } from "../interview";
import {
  mockAssessmentQuestions,
  mockOpenEvaluation,
  mockResultAnalysis,
} from "../mock/assessment";
import { mockCvAnalysis } from "../mock/cv-analysis";
import { mockAnswerEvaluation, mockInterviewQuestions } from "../mock/interview";
import { mockJobMatch } from "../mock/job-match";
import { mockBio, mockHeadline, mockProject, mockSkillSummary } from "../mock/portfolio";
import type { BioInput, HeadlineInput, ProjectDraft, SkillSummaryInput } from "../portfolio";
import { mockRoadmap } from "../mock/roadmap";
import type { RoadmapGenerationInput } from "../roadmap";
import type { AIProvider, StructuredRequest, StructuredResult } from "../types";

type Responder = (input: unknown) => unknown;

const responders: Record<string, Responder> = {
  "cv-analysis": (input) => mockCvAnalysis((input as { cvText: string }).cvText),
  roadmap: (input) => mockRoadmap(input as RoadmapGenerationInput),
  "interview-questions": (input) => mockInterviewQuestions(input as InterviewGenerationInput),
  "interview-evaluation": (input) => mockAnswerEvaluation(input as AnswerEvaluationInput),
  "assessment-questions": (input) => mockAssessmentQuestions(input as AssessmentGenerationInput),
  "assessment-evaluation": (input) => mockOpenEvaluation(input as OpenAnswerInput),
  "assessment-analysis": (input) => mockResultAnalysis(input as ResultAnalysisInput),
  "portfolio-headline": (input) => mockHeadline(input as HeadlineInput),
  "portfolio-bio": (input) => mockBio(input as BioInput),
  "portfolio-project": (input) => mockProject(input as ProjectDraft),
  "portfolio-skill-summary": (input) => mockSkillSummary(input as SkillSummaryInput),
  "job-match": (input) => {
    const { cvText, jobDescription } = input as { cvText: string; jobDescription: string };
    return mockJobMatch(cvText, jobDescription);
  },
};

/**
 * Deterministic development/test provider. Never calls a network service.
 * Output is still validated against the request schema, like a real provider.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly isMock = true;

  constructor(private readonly delayMs: number = 0) {}

  async generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const responder = responders[request.task];
    if (!responder) {
      return { ok: false, error: "provider_error", message: `No mock for task ${request.task}` };
    }
    if (this.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.delayMs));

    const parsed = request.schema.safeParse(responder(request.input));
    return parsed.success
      ? { ok: true, data: parsed.data, model: "mock-rules-v1" }
      : { ok: false, error: "invalid_output", message: "Mock output failed validation" };
  }
}
