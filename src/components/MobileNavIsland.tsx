"use client";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
}

const navGroups = [
  {
    label: null,
    items: [
      { href: "/", label: "Home" },
      { href: "/about", label: "About" },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { href: "/projects", label: "Projects" },
      { href: "/certifications", label: "Certifications" },
      { href: "/resume", label: "Resume" },
    ],
  },
  {
    label: "Publications",
    items: [
      { href: "/writeups", label: "Writeups" },
      { href: "/research", label: "Research" },
      { href: "/notes", label: "Notes" },
      { href: "/project-logs", label: "Project Logs" },
    ],
  },
  {
    label: null,
    items: [{ href: "/contact", label: "Contact" }],
  },
];

interface Props {
  currentPath: string;
}

export default function MobileNavIsland({ currentPath }: Props) {
  const [open, setOpen] = useState(false);

  const path = currentPath.replace(/\/$/, "") || "/";

  function isActive(href: string): boolean {
    if (href === "/") return path === "/";
    return path === href || path.startsWith(href + "/");
  }

  return (
    <>
      {/* Hamburger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
      >
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" x2="20" y1="12" y2="12"/>
            <line x1="4" x2="20" y1="6" y2="6"/>
            <line x1="4" x2="20" y1="18" y2="18"/>
          </svg>
        )}
      </button>

      {/* Overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-in drawer */}
      <nav
        id="mobile-nav-drawer"
        className={[
          "fixed top-14 left-0 bottom-0 z-50 w-64 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] overflow-y-auto transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-label="Mobile navigation"
        aria-hidden={!open}
      >
        <div className="px-4 py-6 flex flex-col gap-4">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} className={groupIdx > 0 ? "mt-2" : ""}>
              {group.label && (
                <p className="px-2 mb-1 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "flex items-center px-2 py-2 rounded-md text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "font-medium text-primary bg-primary/10 border-l-2 border-primary -ml-px pl-[calc(0.5rem+1px)]"
                        : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
