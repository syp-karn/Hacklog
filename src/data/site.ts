/**
 * site.ts — Central data file for the Hacklog personal site.
 *
 * This file is the single source of truth for all personal data used across the site.
 */

export const SITE = {
  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------
  name: "B S Poorvaj Pranav",
  handle: "syp-karn",
  initials: "BP",
  tagline: "Cybersecurity / Offensive Security",
  avatarUrl: "/avatar.jpg",
  ogImage: "/og_image.png",

  // Short description used in hero and meta tags
  shortBio: "Cybersecurity practitioner focused on offensive security, penetration testing, and vulnerability research. I document what I learn, share what I build, and publish writeups of machines I pwn.",

  // Current focus (shown on homepage)
  currentFocus: [
    "Hunting bugs and vulnerability research",
    "Familiarizing myself with AD",
    "Trying automations",
  ],

  // ---------------------------------------------------------------------------
  // Contact / Social
  // ---------------------------------------------------------------------------
  github: "https://github.com/syp-karn",
  linkedin: "https://linkedin.com/in/poorvajbs",
  email: "the.poorvaj@gmail.com",
  resumeUrl: "https://drive.google.com/file/d/1rB1lj_-HyYAOluy7ZeDk5UzxqXbukPqU/view?usp=sharing",
  twitter: "",

  // ---------------------------------------------------------------------------
  // About page content
  // ---------------------------------------------------------------------------
  about: {
    summary: `I am a sophomore at IIIT Sri City with a strong passion for cybersecurity, specializing in Offensive Security. I have hands-on experience in penetration testing, web application security testing, and cloud security research. Currently bug hunting and doing vulnerability research and dabbling other things security-related.`,

    experience: [
      {
        title: "Cybersecurity Intern",
        company: "Sennovate Inc.",
        logo: "/sennovate.png",
        period: "Feb 2026 – Present",
        description: [
          "Researched and documented MITRE ATT&CK tactics/techniques; produced a tools-to-techniques reference to support red-team knowledge and future assessments.",
          "Helping with AI automation of cybersecurity workflows.",
        ],
      },
    ],

    education: [
      {
        degree: "B.Tech – Computer Science & Engineering (Cybersecurity)",
        school: "IIIT Sri City",
        period: "2024 – 2028",
        description: "",
        logo: "",
      },
    ],

    skills: {
      "Skills": [
        "Penetration Testing",
        "Web Application Security",
        "Network Security",
        "Reverse Engineering",
        "OSINT",
      ],
      "Tools & Platforms": [
        "Burp Suite",
        "Nmap",
        "Wireshark",
        "SQLMap",
        "ffuf",
        "GoBuster",
        "BloodHound",
        "Ghidra",
      ],
      "Languages": [
        "Python",
        "Bash",
        "C",
      ],
      "Others": [
        "Linux",
        "Windows",
        "AWS",
      ],
    },

    // Achievements — e.g. CTF placements, bug bounty, academic honours
    achievements: [
      // Add your achievements here. Example:
      // "Top 10% globally — PlaceholderCTF 2025",
      // "Bug bounty: XSS in example.com (acknowledged)",
    ] as string[],

    // Volunteering — clubs, open source contributions, mentorship, etc.
    volunteering: [
      // Add volunteering entries here. Example:
      // { role: "Security Club Lead", org: "IIIT Sri City Cybersec Club", period: "2024 – Present", description: "" },
    ] as { role: string; org: string; period: string; description: string }[],
  },

  // ---------------------------------------------------------------------------
  // Certifications
  // ---------------------------------------------------------------------------
  certifications: [
    {
      name: "Certified Web Exploitation Specialist (CWES)",
      issuer: "Hack The Box",
      date: "Jul 2026",
      badge: "/cwes.png",
      credentialUrl: "https://www.credly.com/badges/693dd79f-c309-4d25-99ef-c91da9b27731/public_url",
    },
    {
      name: "eLearnSecurity Junior Penetration Tester (eJPTv2)",
      issuer: "INE",
      date: "Dec 2024",
      badge: "",
      credentialUrl: "https://certs.ine.com/93df60a7-15d2-4fce-848e-f56c99dda39e",
    },
  ],
} as const;

export type SiteData = typeof SITE;
