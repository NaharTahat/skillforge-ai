import "server-only";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { cvAnalysisReportSchema } from "@/lib/cv/analysis-schema";
import { normalizeForMatch, termAppearsIn } from "@/lib/cv/grounding";
import { prisma } from "@/lib/db/prisma";
import { skillScoreSchema } from "@/lib/assessment/schema";
import { jobMatchReportSchema } from "@/lib/job-match/schema";
import { computePortfolioCompletion } from "@/lib/portfolio/completion";
import {
  classifyAssessment,
  evidenceStrength,
  type EvidenceCounts,
} from "@/lib/portfolio/evidence";
import { skillKey } from "@/lib/roadmap/prioritization";

/**
 * Private (owner-only) portfolio reads. Every query is scoped by the session
 * user's id. Skill evidence is computed live from the user's own records, so it
 * can't go stale and can't be edited by hand.
 */

/** Same skill: identical name, or the skill named inside a longer label ("Kubernetes in production"). */
export function sameSkill(name: string, other: string): boolean {
  return skillKey(name) === skillKey(other) || termAppearsIn(name, normalizeForMatch(other));
}

export type EvidenceItem = {
  type: "PROJECT" | "CERTIFICATION" | "ASSESSMENT" | "INTERVIEW" | "CV" | "JOB_MATCH" | "ROADMAP";
  label: string;
  detail: string;
  href: string;
  date: Date | null;
};

export type SkillEvidence = {
  items: EvidenceItem[];
  counts: EvidenceCounts;
  strength: ReturnType<typeof evidenceStrength>;
  latestAssessment: { percentage: number; label: string; date: Date } | null;
  lastAssessed: Date | null;
};

/** Collects every evidence source once, then matches each of the user's skills against it. */
async function loadEvidenceSources(userId: string) {
  const [projects, certifications, results, answers, cvAnalysis, jobRuns, roadmapItems] =
    await Promise.all([
      prisma.project.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          status: true,
          visibility: true,
          skills: { select: { name: true } },
        },
      }),
      prisma.certification.findMany({
        where: { userId },
        select: { id: true, name: true, issuer: true, skills: true },
      }),
      prisma.assessmentResult.findMany({
        where: { assessment: { userId, status: { in: ["COMPLETED", "EXPIRED"] } } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          skillBreakdown: true,
          createdAt: true,
          assessment: { select: { id: true, title: true } },
        },
      }),
      prisma.interviewQuestion.findMany({
        where: {
          interview: { userId, status: "COMPLETED" },
          skill: { not: null },
          answer: { status: "EVALUATED" },
        },
        select: {
          skill: true,
          answer: { select: { score: true } },
          interview: { select: { id: true, target: true, completedAt: true } },
        },
      }),
      prisma.cvAnalysis.findFirst({
        where: { status: "COMPLETED", cv: { userId } },
        orderBy: { createdAt: "desc" },
        select: { result: true, cvId: true, createdAt: true },
      }),
      prisma.jobAnalysis.findMany({
        where: { status: "COMPLETED", job: { userId } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { result: true, createdAt: true, job: { select: { id: true, title: true } } },
      }),
      prisma.roadmapItem.findMany({
        where: { status: "COMPLETED", roadmap: { userId } },
        select: { title: true, skill: true, completedAt: true, roadmapId: true },
      }),
    ]);
  const cv = cvAnalysis ? cvAnalysisReportSchema.safeParse(cvAnalysis.result) : null;
  return {
    projects,
    certifications,
    results: results.map((r) => ({
      ...r,
      skills: z.array(skillScoreSchema).catch([]).parse(r.skillBreakdown),
    })),
    answers,
    cvSkills: cv?.success ? cv.data.skills.filter((s) => s.verified).map((s) => s.name) : [],
    cvId: cvAnalysis?.cvId ?? null,
    cvDate: cvAnalysis?.createdAt ?? null,
    jobs: jobRuns.map((j) => {
      const report = jobMatchReportSchema.safeParse(j.result);
      return {
        ...j.job,
        date: j.createdAt,
        present: report.success
          ? report.data.requirements.filter((r) => r.match === "PRESENT").map((r) => r.term)
          : [],
      };
    }),
    roadmapItems,
  };
}

type Sources = Awaited<ReturnType<typeof loadEvidenceSources>>;

function evidenceFor(name: string, src: Sources): SkillEvidence {
  const items: EvidenceItem[] = [];
  const projects = src.projects.filter((p) =>
    p.skills.some((s) => skillKey(s.name) === skillKey(name)),
  );
  for (const p of projects) {
    items.push({
      type: "PROJECT",
      label: p.title,
      detail: `Project · ${p.status.toLowerCase().replace("_", " ")} · ${p.visibility.toLowerCase()}`,
      href: `/dashboard/portfolio/projects/${p.id}`,
      date: null,
    });
  }
  const certs = src.certifications.filter((c) =>
    c.skills.some((s) => skillKey(s) === skillKey(name)),
  );
  for (const c of certs)
    items.push({
      type: "CERTIFICATION",
      label: c.name,
      detail: `Certification · ${c.issuer} · user-provided`,
      href: "/dashboard/portfolio/edit#certifications",
      date: null,
    });

  let latest: SkillEvidence["latestAssessment"] = null;
  for (const r of src.results) {
    const s = r.skills.find((x) => skillKey(x.skill) === skillKey(name));
    if (!s) continue;
    if (!latest)
      latest = {
        percentage: s.percentage,
        label: classifyAssessment(s.percentage).label,
        date: r.createdAt,
      };
    items.push({
      type: "ASSESSMENT",
      label: `${r.assessment.title}: ${s.percentage}%`,
      detail: `Assessment · ${classifyAssessment(s.percentage).label}`,
      href: `/dashboard/assessments/${r.assessment.id}/results`,
      date: r.createdAt,
    });
  }

  const answers = src.answers.filter(
    (a) => a.skill && sameSkill(name, a.skill) && a.answer?.score != null,
  );
  const interviewAverage = answers.length
    ? Math.round(answers.reduce((s, a) => s + a.answer!.score!, 0) / answers.length)
    : null;
  for (const [id, group] of Map.groupBy(answers, (a) => a.interview.id)) {
    const first = group[0]!;
    items.push({
      type: "INTERVIEW",
      label: `AI Interview: ${first.interview.target}`,
      detail: `${group.length} answer${group.length === 1 ? "" : "s"} on this skill`,
      href: `/dashboard/interview/${id}`,
      date: first.interview.completedAt,
    });
  }

  const cvVerified = src.cvSkills.some((s) => skillKey(s) === skillKey(name));
  if (cvVerified && src.cvId)
    items.push({
      type: "CV",
      label: "Verified in your CV analysis",
      detail: "A quote in your CV supports this skill",
      href: `/dashboard/cv/${src.cvId}`,
      date: src.cvDate,
    });

  const jobs = src.jobs.filter((j) => j.present.some((t) => sameSkill(name, t)));
  for (const j of jobs.slice(0, 3))
    items.push({
      type: "JOB_MATCH",
      label: `Job Match: ${j.title ?? "Untitled job"}`,
      detail: "Shown in your CV for this job",
      href: `/dashboard/job-match/${j.id}`,
      date: j.date,
    });

  const tasks = src.roadmapItems.filter((t) => sameSkill(name, t.skill));
  for (const t of tasks.slice(0, 3))
    items.push({
      type: "ROADMAP",
      label: `Roadmap task: ${t.title}`,
      detail: "Completed",
      href: `/dashboard/roadmap/${t.roadmapId}`,
      date: t.completedAt,
    });

  const counts: EvidenceCounts = {
    latestAssessment: latest?.percentage ?? null,
    projects: projects.filter((p) => p.status === "COMPLETED" || p.status === "IN_PROGRESS").length,
    certifications: certs.length,
    interviewAverage,
    cvVerified,
    jobMatchPresent: jobs.length > 0,
    roadmapTasksCompleted: tasks.length,
  };
  const dates = [latest?.date, ...answers.map((a) => a.interview.completedAt)].filter(
    (d): d is Date => !!d,
  );
  return {
    items,
    counts,
    strength: evidenceStrength(counts),
    latestAssessment: latest,
    lastAssessed: dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null,
  };
}

export async function listMySkills() {
  const user = await requireUser();
  const [skills, src] = await Promise.all([
    prisma.userSkill.findMany({
      where: { userId: user.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        level: true,
        visibility: true,
        summary: true,
        createdAt: true,
        skill: { select: { name: true, category: true } },
      },
    }),
    loadEvidenceSources(user.id),
  ]);
  return skills.map((s) => ({
    ...s,
    name: s.skill.name,
    evidence: evidenceFor(s.skill.name, src),
  }));
}
export type MySkill = Awaited<ReturnType<typeof listMySkills>>[number];

export async function getMySkill(userSkillId: string) {
  const user = await requireUser();
  const skill = await prisma.userSkill.findFirst({
    where: { id: userSkillId, userId: user.id },
    select: {
      id: true,
      level: true,
      visibility: true,
      summary: true,
      createdAt: true,
      skill: { select: { name: true, category: true } },
    },
  });
  if (!skill) return null;
  const src = await loadEvidenceSources(user.id);
  return { ...skill, name: skill.skill.name, evidence: evidenceFor(skill.skill.name, src) };
}

/** Dashboard overview: profile, real counts and deterministic completion. */
export async function getPortfolioOverview() {
  const user = await requireUser();
  const [account, counts, skills, assessments] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        name: true,
        firstName: true,
        lastName: true,
        image: true,
        username: true,
        profile: {
          select: {
            headline: true,
            bio: true,
            location: true,
            websiteUrl: true,
            githubUrl: true,
            linkedinUrl: true,
          },
        },
        passport: { select: { isPublic: true } },
        _count: {
          select: {
            projects: true,
            educations: true,
            certifications: true,
            achievements: true,
            experiences: true,
          },
        },
      },
    }),
    prisma.project.count({ where: { userId: user.id, visibility: "PUBLIC" } }),
    prisma.userSkill.findMany({
      where: { userId: user.id },
      select: { skill: { select: { name: true, id: true } } },
    }),
    prisma.assessment.count({
      where: { userId: user.id, status: { in: ["COMPLETED", "EXPIRED"] } },
    }),
  ]);
  const skillIds = skills.map((s) => s.skill.id);
  const skillNames = skills.map((s) => s.skill.name);
  const [linkedToProject, certs] = await Promise.all([
    prisma.project.findMany({
      where: { userId: user.id, skills: { some: { id: { in: skillIds } } } },
      select: { skills: { select: { id: true } } },
    }),
    prisma.certification.findMany({ where: { userId: user.id }, select: { skills: true } }),
  ]);
  const evidenced = new Set<string>();
  for (const p of linkedToProject)
    for (const s of p.skills) if (skillIds.includes(s.id)) evidenced.add(s.id);
  for (const c of certs)
    for (const n of c.skills) {
      const match = skills.find((s) => skillKey(s.skill.name) === skillKey(n));
      if (match) evidenced.add(match.skill.id);
    }
  const displayName =
    [account.firstName, account.lastName].filter(Boolean).join(" ") || account.name || null;
  return {
    displayName,
    image: account.image,
    username: account.username,
    isPublic: account.passport?.isPublic ?? false,
    profile: account.profile,
    mainSkills: skillNames.slice(0, 8),
    stats: {
      projects: account._count.projects,
      publicProjects: counts,
      skills: skills.length,
      certifications: account._count.certifications,
      assessments,
      educations: account._count.educations,
      achievements: account._count.achievements,
      experiences: account._count.experiences,
    },
    completion: computePortfolioCompletion({
      hasName: Boolean(displayName),
      headline: account.profile?.headline ?? null,
      bio: account.profile?.bio ?? null,
      projects: account._count.projects,
      skills: skills.length,
      skillsWithEvidence: evidenced.size,
      educations: account._count.educations,
      certifications: account._count.certifications,
      achievements: account._count.achievements,
      isPublic: account.passport?.isPublic ?? false,
      username: account.username,
    }),
  };
}

/** Everything the editor page manages (owner only). */
export async function getPortfolioEditor() {
  const user = await requireUser();
  const [profile, educations, certifications, achievements, experiences, skills] =
    await Promise.all([
      prisma.profile.findUnique({
        where: { userId: user.id },
        select: {
          headline: true,
          bio: true,
          location: true,
          websiteUrl: true,
          githubUrl: true,
          linkedinUrl: true,
        },
      }),
      prisma.education.findMany({
        where: { userId: user.id },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      }),
      prisma.certification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.achievement.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.experience.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      prisma.userSkill.findMany({
        where: { userId: user.id },
        select: { skill: { select: { name: true } } },
      }),
    ]);
  return {
    profile,
    educations,
    certifications,
    achievements,
    experiences,
    skillNames: skills.map((s) => s.skill.name),
  };
}
export type PortfolioEditorData = Awaited<ReturnType<typeof getPortfolioEditor>>;

export async function listMyProjects() {
  const user = await requireUser();
  return prisma.project.findMany({
    where: { userId: user.id },
    orderBy: [{ featured: "desc" }, { position: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      shortDescription: true,
      technologies: true,
      status: true,
      featured: true,
      visibility: true,
      repositoryUrl: true,
      liveUrl: true,
      skills: { select: { name: true } },
      _count: { select: { evidence: true } },
    },
  });
}
export type MyProjectListItem = Awaited<ReturnType<typeof listMyProjects>>[number];

/** The user's skills as project-form options (UserSkill id + name). */
export async function mySkillOptions() {
  const user = await requireUser();
  const skills = await prisma.userSkill.findMany({
    where: { userId: user.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, skill: { select: { id: true, name: true } } },
  });
  return skills.map((s) => ({ id: s.id, skillId: s.skill.id, name: s.skill.name }));
}

export async function getMyProject(projectId: string) {
  const user = await requireUser();
  return prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: {
      id: true,
      title: true,
      slug: true,
      shortDescription: true,
      description: true,
      role: true,
      technologies: true,
      repositoryUrl: true,
      liveUrl: true,
      imageUrl: true,
      startDate: true,
      endDate: true,
      status: true,
      featured: true,
      visibility: true,
      skills: { select: { id: true, name: true } },
      evidence: {
        orderBy: { createdAt: "asc" },
        select: { id: true, kind: true, label: true, url: true },
      },
    },
  });
}
export type MyProject = NonNullable<Awaited<ReturnType<typeof getMyProject>>>;

export async function getMySettings() {
  const user = await requireUser();
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { username: true, passport: true },
  });
  return { username: account.username, passport: account.passport };
}
