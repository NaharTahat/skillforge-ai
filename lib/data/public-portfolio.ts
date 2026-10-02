import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { skillScoreSchema } from "@/lib/assessment/schema";
import { evidenceStrength, classifyAssessment } from "@/lib/portfolio/evidence";
import { skillKey } from "@/lib/roadmap/prioritization";
import { usernameSchema } from "@/lib/portfolio/validation";
import { sameSkill } from "./portfolio";

/**
 * Public portfolio reads. A portfolio is visible only when its owner turned it
 * public; inside it, only sections that are switched on and items marked PUBLIC
 * appear. Nothing private is ever selected here: no email, CV, answers, job
 * matches, roadmap details or internal ids (projects are addressed by slug).
 */

async function publicOwner(rawUsername: string) {
  const parsed = usernameSchema.safeParse(rawUsername);
  if (!parsed.success) return null;
  const user = await prisma.user.findFirst({
    where: { username: parsed.data, passport: { isPublic: true } },
    select: {
      id: true,
      username: true,
      name: true,
      firstName: true,
      lastName: true,
      image: true,
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
      passport: true,
    },
  });
  return user?.passport ? { ...user, passport: user.passport } : null;
}

async function publicSkills(
  userId: string,
  flags: {
    showAssessments: boolean;
    showInterviewScore: boolean;
    showProjects: boolean;
    showCertifications: boolean;
  },
) {
  const [skills, projects, certifications, results, answers] = await Promise.all([
    prisma.userSkill.findMany({
      where: { userId, visibility: "PUBLIC" },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { level: true, summary: true, skill: { select: { name: true } } },
    }),
    flags.showProjects
      ? prisma.project.findMany({
          where: { userId, visibility: "PUBLIC" },
          select: { title: true, slug: true, skills: { select: { name: true } } },
        })
      : [],
    flags.showCertifications
      ? prisma.certification.findMany({
          where: { userId, visibility: "PUBLIC" },
          select: { name: true, issuer: true, skills: true },
        })
      : [],
    flags.showAssessments
      ? prisma.assessmentResult.findMany({
          where: { assessment: { userId, status: { in: ["COMPLETED", "EXPIRED"] } } },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { skillBreakdown: true, createdAt: true },
        })
      : [],
    flags.showInterviewScore
      ? prisma.interviewQuestion.findMany({
          where: {
            interview: { userId, status: "COMPLETED" },
            skill: { not: null },
            answer: { status: "EVALUATED" },
          },
          select: { skill: true, answer: { select: { score: true } } },
        })
      : [],
  ]);
  const parsedResults = results.map((r) => ({
    date: r.createdAt,
    skills: z.array(skillScoreSchema).catch([]).parse(r.skillBreakdown),
  }));
  return skills.map((s) => {
    const name = s.skill.name;
    const linkedProjects = projects.filter((p) =>
      p.skills.some((x) => skillKey(x.name) === skillKey(name)),
    );
    const linkedCerts = certifications.filter((c) =>
      c.skills.some((x) => skillKey(x) === skillKey(name)),
    );
    const latest = parsedResults
      .map((r) => ({ date: r.date, s: r.skills.find((x) => skillKey(x.skill) === skillKey(name)) }))
      .find((r) => r.s);
    const skillAnswers = answers.filter(
      (a) => a.skill && sameSkill(name, a.skill) && a.answer?.score != null,
    );
    const interviewAverage = skillAnswers.length
      ? Math.round(skillAnswers.reduce((t, a) => t + a.answer!.score!, 0) / skillAnswers.length)
      : null;
    const strength = evidenceStrength({
      latestAssessment: latest?.s?.percentage ?? null,
      projects: linkedProjects.length,
      certifications: linkedCerts.length,
      interviewAverage,
      // Private sources are never used publicly.
      cvVerified: false,
      jobMatchPresent: false,
      roadmapTasksCompleted: 0,
    });
    return {
      name,
      level: s.level,
      summary: s.summary,
      strength,
      projects: linkedProjects.map((p) => ({ title: p.title, slug: p.slug })),
      certifications: linkedCerts.map((c) => ({ name: c.name, issuer: c.issuer })),
      assessment: latest?.s
        ? {
            percentage: latest.s.percentage,
            label: classifyAssessment(latest.s.percentage).label,
            date: latest.date,
          }
        : null,
      interviewAnswers: skillAnswers.length,
    };
  });
}

export async function getPublicPortfolio(username: string) {
  const owner = await publicOwner(username);
  if (!owner) return null;
  const f = owner.passport;
  const [projects, educations, certifications, achievements, experiences, skills] =
    await Promise.all([
      f.showProjects
        ? prisma.project.findMany({
            where: { userId: owner.id, visibility: "PUBLIC" },
            orderBy: [{ featured: "desc" }, { position: "asc" }, { createdAt: "desc" }],
            select: {
              slug: true,
              title: true,
              shortDescription: true,
              technologies: true,
              status: true,
              featured: true,
              repositoryUrl: true,
              liveUrl: true,
              skills: { select: { name: true } },
            },
          })
        : [],
      f.showEducation
        ? prisma.education.findMany({
            where: { userId: owner.id, visibility: "PUBLIC" },
            orderBy: [{ position: "asc" }, { createdAt: "asc" }],
            select: {
              institution: true,
              degree: true,
              field: true,
              startDate: true,
              endDate: true,
              grade: true,
              description: true,
            },
          })
        : [],
      f.showCertifications
        ? prisma.certification.findMany({
            where: { userId: owner.id, visibility: "PUBLIC" },
            orderBy: { createdAt: "desc" },
            select: {
              name: true,
              issuer: true,
              issueDate: true,
              expirationDate: true,
              credentialId: true,
              credentialUrl: true,
              description: true,
            },
          })
        : [],
      f.showAchievements
        ? prisma.achievement.findMany({
            where: { userId: owner.id, visibility: "PUBLIC" },
            orderBy: { createdAt: "desc" },
            select: {
              title: true,
              kind: true,
              description: true,
              issuer: true,
              date: true,
              url: true,
            },
          })
        : [],
      f.showExperience
        ? prisma.experience.findMany({
            where: { userId: owner.id, visibility: "PUBLIC" },
            orderBy: { createdAt: "desc" },
            select: {
              company: true,
              title: true,
              description: true,
              startDate: true,
              endDate: true,
              location: true,
              employmentType: true,
            },
          })
        : [],
      f.showSkills ? publicSkills(owner.id, f) : [],
    ]);
  const p = owner.profile;
  return {
    username: owner.username!,
    displayName:
      [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.name || owner.username!,
    image: owner.image,
    headline: p?.headline ?? null,
    about: f.showAbout ? { bio: p?.bio ?? null, location: p?.location ?? null } : null,
    links: f.showLinks
      ? {
          website: p?.websiteUrl ?? null,
          github: p?.githubUrl ?? null,
          linkedin: p?.linkedinUrl ?? null,
        }
      : null,
    projects,
    skills,
    educations,
    certifications,
    achievements,
    experiences,
  };
}
export type PublicPortfolio = NonNullable<Awaited<ReturnType<typeof getPublicPortfolio>>>;

export async function getPublicProject(username: string, slug: string) {
  const owner = await publicOwner(username);
  if (!owner || !owner.passport.showProjects || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const project = await prisma.project.findFirst({
    where: { userId: owner.id, slug, visibility: "PUBLIC" },
    select: {
      slug: true,
      title: true,
      shortDescription: true,
      description: true,
      role: true,
      technologies: true,
      repositoryUrl: true,
      liveUrl: true,
      startDate: true,
      endDate: true,
      status: true,
      skills: { select: { name: true } },
      evidence: { orderBy: { createdAt: "asc" }, select: { kind: true, label: true, url: true } },
    },
  });
  if (!project) return null;
  return {
    owner: {
      username: owner.username!,
      displayName:
        [owner.firstName, owner.lastName].filter(Boolean).join(" ") ||
        owner.name ||
        owner.username!,
    },
    project,
  };
}
