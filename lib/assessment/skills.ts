import { normalizeForMatch, termAppearsIn } from "@/lib/cv/grounding";

/**
 * The supported skill catalog. Assessments only ever test skills in this list;
 * job requirements, roadmap skills and career goals are mapped onto it, and
 * anything outside it is rejected rather than invented.
 */
export const SUPPORTED_SKILLS = [
  { name: "Python", group: "Programming" },
  { name: "JavaScript", group: "Programming" },
  { name: "TypeScript", group: "Programming" },
  { name: "Java", group: "Programming" },
  { name: "C++", group: "Programming" },
  { name: "Go", group: "Programming" },
  { name: "Rust", group: "Programming" },
  { name: "Algorithms", group: "Programming" },
  { name: "Git", group: "Programming" },
  { name: "SQL", group: "Data" },
  { name: "PostgreSQL", group: "Data" },
  { name: "Data Analysis", group: "Data" },
  { name: "Statistics", group: "Data" },
  { name: "Pandas", group: "Data" },
  { name: "Excel", group: "Data" },
  { name: "Power BI", group: "Data" },
  { name: "Tableau", group: "Data" },
  { name: "Machine Learning", group: "AI / ML" },
  { name: "Deep Learning", group: "AI / ML" },
  { name: "PyTorch", group: "AI / ML" },
  { name: "TensorFlow", group: "AI / ML" },
  { name: "scikit-learn", group: "AI / ML" },
  { name: "NLP", group: "AI / ML" },
  { name: "Docker", group: "Cloud & DevOps" },
  { name: "Kubernetes", group: "Cloud & DevOps" },
  { name: "AWS", group: "Cloud & DevOps" },
  { name: "Azure", group: "Cloud & DevOps" },
  { name: "Google Cloud", group: "Cloud & DevOps" },
  { name: "CI/CD", group: "Cloud & DevOps" },
  { name: "Linux", group: "Cloud & DevOps" },
  { name: "React", group: "Web" },
  { name: "Next.js", group: "Web" },
  { name: "Node.js", group: "Web" },
  { name: "HTML", group: "Web" },
  { name: "CSS", group: "Web" },
  { name: "REST APIs", group: "Web" },
  { name: "Cybersecurity", group: "Security" },
  { name: "Network Security", group: "Security" },
  { name: "Penetration Testing", group: "Security" },
  { name: "SIEM", group: "Security" },
] as const;

export type SupportedSkill = (typeof SUPPORTED_SKILLS)[number]["name"];
export const SKILL_NAMES: readonly string[] = SUPPORTED_SKILLS.map((s) => s.name);

/** The canonical catalog name for `name` (case-insensitive), or null when unsupported. */
export function supportedSkill(name: string): string | null {
  const key = name.trim().toLowerCase();
  return SKILL_NAMES.find((s) => s.toLowerCase() === key) ?? null;
}

/** Too ambiguous to detect in free text ("go to the office"); selectable explicitly only. */
const NOT_DETECTED_IN_TEXT = new Set(["Go"]);

/** Catalog skills named in a piece of text, longest names first so "PostgreSQL" wins over "SQL". */
export function skillsInText(text: string): string[] {
  const normalized = normalizeForMatch(text);
  const found: string[] = [];
  for (const name of [...SKILL_NAMES].sort((a, b) => b.length - a.length)) {
    if (NOT_DETECTED_IN_TEXT.has(name)) continue;
    if (!termAppearsIn(name, normalized)) continue;
    // "SQL" inside "PostgreSQL" is the same mention, not a second skill.
    if (found.some((f) => normalizeForMatch(f).includes(normalizeForMatch(name)))) continue;
    found.push(name);
  }
  return found;
}

/** Skills typical for each career goal (profile labels), all from the catalog. */
export const ROLE_SKILLS: Record<string, readonly SupportedSkill[]> = {
  "AI Engineer": ["Python", "Machine Learning", "Deep Learning", "REST APIs", "Docker"],
  "Machine Learning Engineer": [
    "Python",
    "Machine Learning",
    "Statistics",
    "SQL",
    "Algorithms",
    "Deep Learning",
  ],
  "Data Scientist": ["Python", "Statistics", "SQL", "Machine Learning", "Data Analysis", "Pandas"],
  "Data Analyst": ["SQL", "Data Analysis", "Excel", "Statistics", "Python", "Power BI"],
  "Software Engineer": ["Algorithms", "Git", "Python", "Java", "SQL", "REST APIs"],
  "Cybersecurity Analyst": [
    "Cybersecurity",
    "Network Security",
    "Linux",
    "SIEM",
    "Penetration Testing",
  ],
  "Frontend Developer": ["HTML", "CSS", "JavaScript", "TypeScript", "React", "Git"],
  "Backend Developer": ["Node.js", "SQL", "PostgreSQL", "REST APIs", "Docker", "Git"],
  "Full Stack Developer": ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "Git"],
};
export const DEFAULT_ROLE_SKILLS: readonly SupportedSkill[] = [
  "Git",
  "SQL",
  "Python",
  "Algorithms",
];
