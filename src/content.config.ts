import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

// ---------------------------------------------------------------------------
// Writeups — HTB machines, CTF challenges, lab writeups
// ---------------------------------------------------------------------------
const writeups = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/writeups" }),
  // Function schema so the `image` helper is available: frontmatter image paths
  // are then resolved relative to the .mdx file into ImageMetadata objects.
  schema: ({ image }) =>
    z.object({
    title: z.string(),
    date: z.string(),
    summary: z.string(),
    platform: z.enum(["htb", "ctf", "lab", "tryhackme", "other"]),
    machineName: z.string().optional(),
    difficulty: z.enum(["easy", "medium", "hard", "insane"]).optional(),
    tags: z.array(z.string()).default([]),
    image: image().optional(),
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

export const collections = {
  writeups,
  notes,
};
