import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

// ---------------------------------------------------------------------------
// Writeups — HTB machines, CTF challenges, lab writeups
// ---------------------------------------------------------------------------
const writeups = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/writeups" }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    summary: z.string(),
    platform: z.enum(["htb", "ctf", "lab", "tryhackme", "other"]),
    machineName: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard", "insane"]).optional(),
    tags: z.array(z.string()).default([]),
    image: z.string().optional(),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
  }),
});

// ---------------------------------------------------------------------------
// Research — CVEs, vulnerability research, analysis, experiments
// ---------------------------------------------------------------------------
const research = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/research" }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    type: z.enum(["cve", "analysis", "experiment", "disclosure", "research"]),
    // CVE-specific fields (optional — only required when type === 'cve')
    cve: z.string().optional(),            // e.g. "CVE-2024-12345"
    severity: z
      .enum(["critical", "high", "medium", "low", "informational"])
      .optional(),
    cvssScore: z.number().min(0).max(10).optional(),
    affectedVersions: z.string().optional(),  // free-form, e.g. "< 2.3.4"
    status: z
      .enum(["draft", "researching", "reported", "disclosed", "patched", "wontfix"])
      .optional(),
    vendor: z.string().optional(),
    references: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
  }),
});

// ---------------------------------------------------------------------------
// Notes — Learning notes, technique references, concepts
// ---------------------------------------------------------------------------
const notes = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/notes" }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
  }),
});

// ---------------------------------------------------------------------------
// Project Logs — Development diaries / logs tied to a named project
// ---------------------------------------------------------------------------
const projectLogs = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/project-logs" }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    summary: z.string(),
    /** The slug of the parent project in src/data/projects.ts */
    project: z.string(),
    projectTitle: z.string().optional(),
    status: z.enum(["in-progress", "paused", "complete"]).default("in-progress"),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  writeups,
  research,
  notes,
  "project-logs": projectLogs,
};
