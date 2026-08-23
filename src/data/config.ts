export const CONFIG = {
  // ---------------------------------------------------------------------------
  // Site Settings
  // ---------------------------------------------------------------------------
  site: {
    url: "https://poorvaj.tech",  // Update when domain is set
    locale: "en_US"
  },

  // ---------------------------------------------------------------------------
  // Author / Identity
  // ---------------------------------------------------------------------------
  author: {
    name: "B S Poorvaj Pranav",
    handle: "hacklog",
    tagline: "Cybersecurity / Offensive Security",
    location: "YOUR LOCATION",
    github: "https://github.com/syp-karn",
    linkedin: "https://linkedin.com/in/poorvajbs",
    email: "the.poorvaj@gmail.com",
    resumeUrl: "/resume.pdf",
  },

  // ---------------------------------------------------------------------------
  // SEO Settings
  // ---------------------------------------------------------------------------
  seo: {
    titleTemplate: "%s | %n",  // %s = page title, %n = author name
    twitterCard: "summary_large_image" as const,
    robots: "index, follow",
    defaultDescription: "Cybersecurity practitioner — offensive security, penetration testing, CTF writeups, vulnerability research, and security tooling.",
    ogImage: "/og_image.png",
  },

  // ---------------------------------------------------------------------------
  // Typography
  // ---------------------------------------------------------------------------
  typography: {
    baseFontSize: 112,  // Slightly smaller than Starfolio default for denser content
  },

  // ---------------------------------------------------------------------------
  // Content Settings
  // ---------------------------------------------------------------------------
  content: {
    postsPerPage: 12,
    latestCountOnHomepage: 6,
    featuredProjectsOnHomepage: 3,
  },

  // ---------------------------------------------------------------------------
  // Theme (dark-first, cybersecurity professional palette)
  // Dark: near-black bg with subtle blue tint, muted emerald accents
  // Light: clean white with same emerald accent
  // ---------------------------------------------------------------------------
  theme: {
    radius: "0.5rem",

    light: {
      background: "oklch(0.99 0 0)",
      foreground: "oklch(0.13 0.01 240)",
      card: "oklch(0.97 0.003 240)",
      cardForeground: "oklch(0.13 0.01 240)",
      popover: "oklch(0.99 0 0)",
      popoverForeground: "oklch(0.13 0.01 240)",
      primary: "oklch(0.52 0.16 145)",           // muted emerald
      primaryForeground: "oklch(0.99 0 0)",
      secondary: "oklch(0.94 0.008 240)",
      secondaryForeground: "oklch(0.25 0.02 240)",
      muted: "oklch(0.94 0.004 240)",
      mutedForeground: "oklch(0.52 0.01 240)",
      accent: "oklch(0.92 0.012 145)",
      accentForeground: "oklch(0.25 0.02 240)",
      destructive: "oklch(0.577 0.245 27.325)",
      border: "oklch(0.88 0.005 240)",
      input: "oklch(0.88 0.005 240)",
      ring: "oklch(0.52 0.16 145)",
    },

    dark: {
      background: "oklch(0.13 0.004 240)",        // near-black with subtle blue
      foreground: "oklch(0.93 0.005 240)",
      card: "oklch(0.17 0.005 240)",
      cardForeground: "oklch(0.93 0.005 240)",
      popover: "oklch(0.17 0.005 240)",
      popoverForeground: "oklch(0.93 0.005 240)",
      primary: "oklch(0.65 0.18 145)",            // muted emerald accent
      primaryForeground: "oklch(0.13 0.004 240)",
      secondary: "oklch(0.22 0.006 240)",
      secondaryForeground: "oklch(0.93 0.005 240)",
      muted: "oklch(0.20 0.006 240)",
      mutedForeground: "oklch(0.60 0.008 240)",
      accent: "oklch(0.24 0.008 240)",
      accentForeground: "oklch(0.93 0.005 240)",
      destructive: "oklch(0.65 0.22 25)",
      border: "oklch(1 0 0 / 8%)",
      input: "oklch(1 0 0 / 10%)",
      ring: "oklch(0.65 0.18 145)",
    },

    // Sidebar specific (slightly different shade from main bg)
    sidebar: {
      dark: {
        background: "oklch(0.11 0.004 240)",
        border: "oklch(1 0 0 / 6%)",
      },
      light: {
        background: "oklch(0.96 0.004 240)",
        border: "oklch(0 0 0 / 8%)",
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Content type badge colours (used in cards and article headers)
  // ---------------------------------------------------------------------------
  badges: {
    writeup: { bg: "oklch(0.25 0.06 145)", fg: "oklch(0.75 0.18 145)", border: "oklch(0.65 0.18 145 / 30%)" },
    research: { bg: "oklch(0.25 0.06 75)", fg: "oklch(0.80 0.18 75)", border: "oklch(0.70 0.18 75 / 30%)" },
    note: { bg: "oklch(0.22 0.06 220)", fg: "oklch(0.72 0.18 220)", border: "oklch(0.62 0.18 220 / 30%)" },
    projectLog: { bg: "oklch(0.22 0.06 290)", fg: "oklch(0.72 0.18 290)", border: "oklch(0.62 0.18 290 / 30%)" },
    project: { bg: "oklch(0.20 0.01 240)", fg: "oklch(0.65 0.01 240)", border: "oklch(0.55 0.01 240 / 30%)" },
  },

  // ---------------------------------------------------------------------------
  // Difficulty badge colours for writeups
  // ---------------------------------------------------------------------------
  difficulty: {
    easy: "oklch(0.65 0.18 145)",
    medium: "oklch(0.75 0.18 75)",
    hard: "oklch(0.65 0.20 30)",
    insane: "oklch(0.55 0.22 325)",
  },

} as const;
