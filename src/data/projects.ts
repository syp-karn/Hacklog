/**
 * projects.ts — Static data for finished projects.
 *
 * Projects are different from Project Logs.
 * Projects = finished or substantially complete work.
 * Project Logs = development diaries for ongoing work.
 *
 * Each project has a slug that maps to /projects/[slug]
 */

export interface Project {
  slug: string;
  title: string;
  description: string;
  longDescription?: string;
  date: string;
  status: "active" | "completed" | "archived" | "wip";
  technologies: string[];
  github?: string;
  demo?: string;
  tags: string[];
  featured: boolean;
  image?: string;
  /** Slugs of project-logs entries that belong to this project */
  relatedLogs?: string[];
}

export const PROJECTS: Project[] = [
  {
    slug: "placeholder-scanner",
    title: "Lightweight Web Vulnerability Scanner",
    description: "A Python-based web vulnerability scanner for common OWASP Top 10 issues. Supports crawling, SQLi detection, XSS probing, and header analysis.",
    longDescription: `
This is a placeholder project description. Replace with your actual project details.

Built to scratch my own itch — I wanted a fast, scriptable scanner I could run against CTF boxes and real assessments without spinning up a full Burp Suite workspace for quick checks.

**Key features:**
- Crawls web apps up to a configurable depth
- Tests for SQL injection, reflected XSS, directory traversal
- Checks security headers (CSP, HSTS, X-Frame-Options)
- Outputs JSON / markdown reports
    `.trim(),
    date: "2025-01-01",
    status: "active",
    technologies: ["Python", "asyncio", "aiohttp", "BeautifulSoup"],
    github: "https://github.com/syp-karn/placeholder-scanner",
    tags: ["python", "web-security", "tooling", "automation"],
    featured: true,
    relatedLogs: ["scanner-dev-log-01"],
  },
  {
    slug: "placeholder-ids",
    title: "ML-Based Intrusion Detection System",
    description: "Academic project: network traffic classifier using Random Forest and LSTM models trained on the CICIDS2017 dataset.",
    date: "2024-06-01",
    status: "completed",
    technologies: ["Python", "scikit-learn", "PyTorch", "Wireshark", "pandas"],
    github: "https://github.com/syp-karn/placeholder-ids",
    tags: ["machine-learning", "network-security", "ids", "python"],
    featured: true,
  },
  {
    slug: "placeholder-ctf-toolkit",
    title: "CTF Toolkit",
    description: "Personal collection of CTF helper scripts: crypto solvers, format string exploits, pwntools wrappers, and steg tools.",
    date: "2024-01-01",
    status: "active",
    technologies: ["Python", "pwntools", "pycryptodome", "PIL"],
    github: "https://github.com/syp-karn/placeholder-ctf-toolkit",
    tags: ["ctf", "python", "exploit-development", "cryptography"],
    featured: false,
  },
];

export function getProjectBySlug(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}

export function getFeaturedProjects(): Project[] {
  return PROJECTS.filter((p) => p.featured);
}
