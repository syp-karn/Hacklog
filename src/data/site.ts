/**
 * site.ts — Central data file for the Hacklog personal site.
 *
 * Replace all YOUR_* placeholders with your actual information.
 * This file is the single source of truth for personal data used across the site.
 */

export const SITE = {
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------
  name: "YOUR NAME",
  handle: "YOUR_HANDLE",           // e.g. "syp-karn" (used in paths, display)
  initials: "YN",                  // Two-letter initials for avatar fallback
  tagline: "Cybersecurity / Offensive Security",
  avatarUrl: "/avatar.png",        // Place your photo at public/avatar.png
  ogImage: "/og_image.png",

  // Short description used in hero and meta tags
  shortBio: "Cybersecurity practitioner focused on offensive security, penetration testing, and vulnerability research. I document what I learn, share what I build, and publish writeups of machines I pwn.",

  // Current focus (shown on homepage)
  currentFocus: [
    "Offensive security & penetration testing",
    "Hack The Box machines and CTF competitions",
    "Vulnerability research and CVE analysis",
    "Security tooling development",
    "Network and web application security",
  ],

  // ---------------------------------------------------------------------------
  // Contact / Social
  // ---------------------------------------------------------------------------
  github: "https://github.com/syp-karn",           // YOUR_GITHUB_URL
  linkedin: "https://linkedin.com/in/YOUR_LINKEDIN",
  email: "your@email.com",
  resumeUrl: "/resume.pdf",                         // Place resume at public/resume.pdf
  twitter: "",                                      // Optional

  // ---------------------------------------------------------------------------
  // About page content (full biography)
  // ---------------------------------------------------------------------------
  about: {
    summary: `
YOUR NAME is a cybersecurity practitioner with a focus on offensive security and penetration testing.
Currently pursuing / recently completed [YOUR EDUCATION / DEGREE].
Interested in how systems break, how to find vulnerabilities before attackers do, and how to build tools that help.

Active on Hack The Box, participating in CTF competitions, and continuously studying offensive techniques across web, network, and binary exploitation domains.
    `.trim(),

    experience: [
      {
        title: "YOUR JOB TITLE",
        company: "YOUR COMPANY",
        period: "20XX — Present",
        description: "YOUR JOB DESCRIPTION",
        logo: "",
      },
    ],

    education: [
      {
        degree: "YOUR DEGREE",
        school: "YOUR SCHOOL / UNIVERSITY",
        period: "20XX — 20XX",
        description: "",
        logo: "",
      },
    ],

    skills: {
      "Offensive Security": [
        "Penetration Testing",
        "Web Application Security",
        "Network Security",
        "Privilege Escalation",
        "Active Directory",
        "OSINT",
      ],
      "Tools & Platforms": [
        "Burp Suite",
        "Metasploit",
        "Nmap",
        "Wireshark",
        "Ghidra",
        "Cobalt Strike",
        "Hack The Box",
      ],
      "Programming": [
        "Python",
        "Bash",
        "Go",
        "C",
        "JavaScript",
        "PowerShell",
      ],
      "Infrastructure": [
        "Linux",
        "Docker",
        "AWS",
        "Networking",
        "Active Directory",
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Certifications (shown on /certifications page)
  // ---------------------------------------------------------------------------
  certifications: [
    {
      name: "YOUR CERTIFICATION",
      issuer: "YOUR ISSUER",
      date: "20XX",
      badge: "",        // Path to badge image if available
      credentialUrl: "",
    },
  ],
} as const;

export type SiteData = typeof SITE;
