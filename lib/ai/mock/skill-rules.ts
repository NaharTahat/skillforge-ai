import type { CvModelOutput } from "@/lib/cv/analysis-schema";

/** Keyword rules shared by the deterministic mock providers (not used by real AI). */
export type SkillRule = {
  name: string;
  category: CvModelOutput["skills"][number]["category"];
  pattern: RegExp;
};

export const SKILL_RULES: SkillRule[] = [
  { name: "Python", category: "PROGRAMMING", pattern: /\bpython\b/i },
  { name: "JavaScript", category: "PROGRAMMING", pattern: /\bjavascript\b/i },
  { name: "TypeScript", category: "PROGRAMMING", pattern: /\btypescript\b/i },
  { name: "Java", category: "PROGRAMMING", pattern: /\bjava\b(?!script)/i },
  { name: "C++", category: "PROGRAMMING", pattern: /\bc\+\+/i },
  { name: "Go", category: "PROGRAMMING", pattern: /\bgolang\b/i },
  { name: "Rust", category: "PROGRAMMING", pattern: /\brust\b/i },
  { name: "SQL", category: "DATA", pattern: /\bsql\b/i },
  { name: "PostgreSQL", category: "DATA", pattern: /\bpostgres(ql)?\b/i },
  { name: "Pandas", category: "DATA", pattern: /\bpandas\b/i },
  { name: "Power BI", category: "DATA", pattern: /\bpower ?bi\b/i },
  { name: "Tableau", category: "DATA", pattern: /\btableau\b/i },
  { name: "Excel", category: "DATA", pattern: /\bexcel\b/i },
  { name: "Machine Learning", category: "AI_ML", pattern: /\bmachine learning\b/i },
  { name: "Deep Learning", category: "AI_ML", pattern: /\bdeep learning\b/i },
  { name: "PyTorch", category: "AI_ML", pattern: /\bpytorch\b/i },
  { name: "TensorFlow", category: "AI_ML", pattern: /\btensorflow\b/i },
  { name: "scikit-learn", category: "AI_ML", pattern: /\bscikit-learn\b|\bsklearn\b/i },
  { name: "NLP", category: "AI_ML", pattern: /\bnlp\b|natural language processing/i },
  { name: "AWS", category: "CLOUD_DEVOPS", pattern: /\baws\b|amazon web services/i },
  { name: "Azure", category: "CLOUD_DEVOPS", pattern: /\bazure\b/i },
  { name: "Google Cloud", category: "CLOUD_DEVOPS", pattern: /\bgcp\b|google cloud/i },
  { name: "Docker", category: "CLOUD_DEVOPS", pattern: /\bdocker\b/i },
  { name: "Kubernetes", category: "CLOUD_DEVOPS", pattern: /\bkubernetes\b|\bk8s\b/i },
  { name: "CI/CD", category: "CLOUD_DEVOPS", pattern: /\bci\/cd\b/i },
  { name: "React", category: "WEB", pattern: /\breact\b/i },
  { name: "Next.js", category: "WEB", pattern: /\bnext\.js\b/i },
  { name: "Node.js", category: "WEB", pattern: /\bnode\.?js\b/i },
  { name: "HTML", category: "WEB", pattern: /\bhtml5?\b/i },
  { name: "CSS", category: "WEB", pattern: /\bcss3?\b/i },
  { name: "REST APIs", category: "WEB", pattern: /\brest(ful)? api/i },
  { name: "Network Security", category: "SECURITY", pattern: /\bnetwork security\b/i },
  {
    name: "Penetration Testing",
    category: "SECURITY",
    pattern: /\bpenetration testing\b|\bpentest/i,
  },
  { name: "SIEM", category: "SECURITY", pattern: /\bsiem\b/i },
  { name: "Git", category: "TOOLS", pattern: /\bgit\b|\bgithub\b/i },
  { name: "Linux", category: "TOOLS", pattern: /\blinux\b/i },
  { name: "Jira", category: "TOOLS", pattern: /\bjira\b/i },
  { name: "Leadership", category: "SOFT_SKILLS", pattern: /\bled\b|\bleadership\b|\bmentor/i },
  {
    name: "Communication",
    category: "SOFT_SKILLS",
    pattern: /\bcommunication\b|\bpresent(ed|ation)/i,
  },
];
