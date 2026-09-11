"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import SidebarNav from "@/components/SidebarNav";

interface Props {
  currentPath: string;
}

function MobileThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const html = document.documentElement;
    const nowDark = html.classList.contains("dark");
    html.classList.toggle("dark", !nowDark);
    try {
      localStorage.setItem("theme", nowDark ? "light" : "dark");
    } catch {}
    setIsDark(!nowDark);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
          Light Mode
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
          </svg>
          Dark Mode
        </>
      )}
    </button>
  );
}

function HamburgerButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={open ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={open}
      aria-controls="mobile-nav-drawer"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {open ? (
          <path d="M18 6 6 18M6 6l12 12" />
        ) : (
          <>
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </>
        )}
      </svg>
    </button>
  );
}

export default function MobileNavIsland({ currentPath }: Props) {
  const [open, setOpen] = useState(false);
  // Mount point for the hamburger button portal (inside the header)
  const [triggerEl, setTriggerEl] = useState<Element | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTriggerEl(document.getElementById("mobile-nav-trigger"));
  }, []);

  // Auto-close drawer when any nav link inside it is clicked
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    const handleLinkClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a")) {
        setOpen(false);
      }
    };
    drawer.addEventListener("click", handleLinkClick);
    return () => drawer.removeEventListener("click", handleLinkClick);
  }, []);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const toggle = () => setOpen((v) => !v);

  return (
    <>
      {/* Portal the button INTO the header's #mobile-nav-trigger slot */}
      {triggerEl && createPortal(
        <HamburgerButton open={open} onClick={toggle} />,
        triggerEl
      )}

      {/*
        Overlay: starts at top-14 (below header) so it NEVER covers the header bar.
        No backdrop-blur — that was causing the header to blur visually.
        z-40 keeps it below the header (z-50).
      */}
      <div
        className={[
          "lg:hidden fixed left-0 right-0 bottom-0 z-40 bg-black/50 transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        style={{ top: "3.5rem" }}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/*
        Slide-in drawer: z-[45] → above overlay, below header.
        Always in DOM — CSS transform handles show/hide for smooth transitions.
      */}
      <div
        id="mobile-nav-drawer"
        ref={drawerRef}
        role="navigation"
        aria-label="Mobile navigation"
        aria-hidden={!open}
        className={[
          "lg:hidden fixed left-0 bottom-0 z-[45] w-72 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] overflow-y-auto",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        style={{ top: "3.5rem" }}
      >
        <div className="flex flex-col h-full px-4 py-4">
          <div className="flex-1">
            <SidebarNav currentPath={currentPath} />
          </div>
          <div className="pt-4 border-t border-[var(--sidebar-border)] mt-4">
            <MobileThemeToggle />
          </div>
        </div>
      </div>
    </>
  );
}
