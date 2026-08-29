import { Icons } from "@/components/icons";

export const DATA = {
  name: "B S Poorvaj Pranav",
  initials: "BP",
  url: "https://poorvaj.tech",
  location: "",
  locationLink: "",
  description:
    "Cybersecurity practitioner focused on offensive security, penetration testing, and vulnerability research.",
  summary:
    "I am a sophomore at IIIT Sri City specializing in cybersecurity and offensive security.",
  avatarUrl: "/avatar.jpg",
  ogImage: "/og_image.png",
  sections: {
    about: { order: 1, enabled: true, heading: "About" },
    work: { order: 2, enabled: true, heading: "Work Experience", presentLabel: "Present" },
    education: { order: 3, enabled: true, heading: "Education" },
    skills: { order: 4, enabled: true, heading: "Skills" },
    projects: { order: 5, enabled: false, label: "Projects", heading: "Projects", text: "" },
    hackathons: { order: 6, enabled: false, label: "Hackathons", heading: "Hackathons", text: "" },
    photos: { order: 7, enabled: false, heading: "Photos" },
    contact: { order: 8, enabled: false, label: "Contact", heading: "Contact", text: "" },
  },
  photos: [],
  skills: [],
  navbar: [{ href: "/", label: "Home" }],
  contact: {
    email: "the.poorvaj@gmail.com",
    tel: "",
    social: {
      GitHub: { name: "GitHub", url: "https://github.com/syp-karn", icon: Icons.github, navbar: true },
      LinkedIn: { name: "LinkedIn", url: "https://linkedin.com/in/poorvajbs", icon: Icons.linkedin, navbar: true },
    },
  },
  work: [],
  education: [],
  projects: [],
  hackathons: [],
} as const;
