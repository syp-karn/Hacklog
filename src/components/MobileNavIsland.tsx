"use client";
import { useState } from "react";
import SidebarNav from "@/components/SidebarNav";

interface Props {
  currentPath: string;
}

export default function MobileNavIsland({ currentPath }: Props) {
  const [open, setOpen] = useState(false);

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
      <div
        id="mobile-nav-drawer"
        className={[
          "fixed top-14 left-0 bottom-0 z-50 w-64 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] overflow-y-auto transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        aria-hidden={!open}
      >
        <div className="px-4 py-4">
          <SidebarNav currentPath={currentPath} />
        </div>
      </div>
    </>
  );
}
