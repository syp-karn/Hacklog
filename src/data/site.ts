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
  url: "https://poorvaj.tech",
  location: "",
  locationLink: "",
  tagline: "Offensive Security",
  avatarUrl: "/avatar.jpg",
  ogImage: "/og_image.png",

  // Short description used in hero and meta tags
  shortBio: "I am a cybersecurity practitioner focused on offensive security, penetration testing, web application security, and vulnerability research. \n This is a personal blog where I share writeups, notes, findings, research, and everything else I uncover in the world of security.",
  description: "Cybersecurity practitioner focused on offensive security, penetration testing, and vulnerability research.",
  summary: "I am a sophomore at IIIT Sri City specializing in cybersecurity and offensive security.",

  // Current focus (shown on homepage)
  currentFocus: [
    "Hunting bugs and vulnerability research",
    "Familiarizing myself with AD",
    "Trying automations",
  ],

  // ---------------------------------------------------------------------------
  // Contact / Social
  // ---------------------------------------------------------------------------
  linkedin: "https://linkedin.com/in/poorvajbs",
  github: "https://github.com/syp-karn",
  email: "the.poorvaj@gmail.com",
  resumeUrl: "https://drive.google.com/file/d/1rB1lj_-HyYAOluy7ZeDk5UzxqXbukPqU/view?usp=sharing",
  twitter: "",

  // ---------------------------------------------------------------------------
  // About page content
  // ---------------------------------------------------------------------------
  about: {
    summary: `I am a sophomore at IIIT Sri City with a strong passion for cybersecurity, specializing in Offensive Security. I enjoy identifying and exploiting vulnerabilities, testing systems to uncover security flaws, and enhancing overall resilience. Currently I am trying out bug hunting, vulnerability research and a few other things.`,

    // Change this array to reorder the sections on the About page.
    sectionOrder: [
      "bio",
      "experience",
      "certifications",
      "skills",
      "education",
      "achievements",
      "volunteering",
      "resume",
    ] as const,

    experience: [
      {
        title: "Security Engineer Intern",
        company: "Sennovate Inc.",
        logo: "/sennovate.png",
        period: "February 2026 – Present",
        description: [
          "Researched and documented MITRE ATT&CK tactics/techniques; produced a tools-to-techniques reference to support red-team knowledge and future assessments.",
          "Helping with AI automation of cybersecurity workflows.",
        ],
      }
    ],

    skills: {
      "Penetration Testing": [
        "Reconnaissance",
        "OSINT",
        "Enumeration",
        "Exploitation",
        "Privilege Escalation",
        "Reporting",
      ],
      "Web Application Pentesting": [
        "Source Code Review",
        "Broken Authentication",
        "Command Injection",
        "File Upload Attacks",
        "Session Security",
        "API Security",
        "Server-Side Attacks"
      ],
      "Tools": [
        "Burp Suite",
        "Nmap",
        "Wireshark",
        "SQLMap",
        "ffuf",
        "GoBuster",
        "BloodHound",
        "Ghidra",
        "Metasploit",
        "Mimikatz"
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
        "Git"
      ]
    },

    education: [
      {
        degree: "B.Tech(Hons.) – Computer Science & Engineering",
        school: "IIIT Sri City",
        period: "2023 – 2027",
        description: "",
        logo: "",
      },
    ],

    // Achievements — e.g. CTF placements, bug bounty, academic honours
    achievements: [
      "Shortlisted for the NCIIPC scheme for a Controlled Penetration Testing Exercise of Critical Information Infrastructure (CII).",
      "AIR 27 - NCIIPC-AICTE Pentathon '25; ranked 27th in the final round from a pool of 20,000 participants."
    ] as string[],

    // Volunteering — clubs, open source contributions, mentorship, etc.
    volunteering: [
      { role: "Cybersecurity Domain Lead", org: "Google Developer Groups IIITS", period: "August 2025 – April 2026", description: "Mentored students in cybersecurity through sessions and workshops, and developed CTF challenges." },
      { role: "Director of Operations", org: "E-Cell IIITS", period: "January 2025 – August 2025", description: "Planned event logistics, coordinated resources, and led operations for event execution." },
      { role: "Outreach Team", org: "Web3ssh", period: "July 2024 – August 2024", description: "Promoted the Web3ssh Summer School and Hackathon 2024 through institutional outreach." },
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
      credentialUrl: "https://profile.hackthebox.com/profile/019e53b5-f930-7359-bcb8-e302a1e6ae25/certificate/HTBCERT-1706CA5DF1",
      tipsUrl: "/notes/cwes-tips",
    },
    {
      name: "eLearnSecurity Junior Penetration Tester (eJPTv2)",
      issuer: "INE",
      date: "Dec 2024",
      badge: "/ejpt.png",
      credentialUrl: "https://certs.ine.com/93df60a7-15d2-4fce-848e-f56c99dda39e",
    },
  ],
} as const;

export type SiteData = typeof SITE;
