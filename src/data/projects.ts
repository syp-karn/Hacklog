/** Static project data. Add real projects here when a project route exists. */

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

export const PROJECTS: Project[] = [];

export function getProjectBySlug(slug: string): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}

export function getFeaturedProjects(): Project[] {
  return PROJECTS.filter((p) => p.featured);
}
