import type { BioInput, HeadlineInput, ProjectDraft, SkillSummaryInput } from "@/lib/ai/portfolio";

/**
 * Deterministic stand-ins for AI portfolio assistance (AI_PROVIDER=mock).
 * They only rephrase the facts they are given. Dev/test hook: a project title
 * containing "[mock:ai-failure]" makes the project description return invalid output.
 */
export const MOCK_FAILURE_MARKER = "[mock:ai-failure]";

export function mockHeadline(input: HeadlineInput) {
  return { roleIndex: 0, skills: input.skills.slice(0, 3) };
}

export function mockBio(input: BioInput) {
  const sentences: { text: string; sources: string[] }[] = [];
  const goal = input.facts.find((f) => f.key === "goal");
  if (goal)
    sentences.push({
      text: `I am working toward a career as ${goal.text.replace(/^Career goal: /, "")}.`,
      sources: [goal.key],
    });
  const edu = input.facts.find((f) => f.key.startsWith("education:"));
  if (edu) sentences.push({ text: `My education: ${edu.text}.`, sources: [edu.key] });
  const skills = input.facts.find((f) => f.key === "skills");
  if (skills)
    sentences.push({
      text: `I work with ${skills.text.replace(/^Skills: /, "")}.`,
      sources: [skills.key],
    });
  const project = input.facts.find((f) => f.key.startsWith("project:"));
  if (project) sentences.push({ text: `Recent work: ${project.text}.`, sources: [project.key] });
  if (sentences.length === 0) {
    const first = input.facts[0]!;
    sentences.push({ text: first.text, sources: [first.key] });
  }
  return { sentences: sentences.slice(0, 4) };
}

export function mockProject(draft: ProjectDraft) {
  if (draft.title.includes(MOCK_FAILURE_MARKER)) return {};
  const highlights = [
    ...(draft.technologies.length ? [`Built with ${draft.technologies.join(", ")}.`] : []),
    ...(draft.skills.length ? [`Applies ${draft.skills.join(", ")}.`] : []),
  ];
  const contributions = draft.role ? [`Worked on the project as ${draft.role}.`] : [];
  return {
    summary: `${draft.title}: ${draft.shortDescription.replace(/\.$/, "")}.`,
    highlights,
    contributions,
  };
}

export function mockSkillSummary(input: SkillSummaryInput) {
  return { summary: `${input.skill} is supported by: ${input.evidence.slice(0, 3).join("; ")}.` };
}
