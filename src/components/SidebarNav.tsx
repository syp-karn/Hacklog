"use client";
import { useState } from "react";

// ────────────────────────────────────────────────────────────────
// Navigation tree definition
//
// To add a new nested item:
//   1. Find the parent group (e.g. "Writeups")
//   2. Add a new object to its `children` array:
//      { label: "New Category", href: "/writeups/new-cat" }
//   3. If that category itself needs children, give it a `children` key
//      and remove `href` (only leaf nodes have hrefs).
//
// To add a top-level nav item (no nesting):
//   { label: "Page Name", href: "/page-name" }
// ────────────────────────────────────────────────────────────────

type NavLeaf = { label: string; href: string; children?: never };
type NavGroup = { label: string; href?: string; children: NavNode[] };
type NavNode = NavLeaf | NavGroup;

interface NavItemConfig {
  label: string | null;
  items: NavNode[];
}

const NAV_GROUPS: NavItemConfig[] = [
  {
    label: null,
    items: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
    ],
  },
  {
    label: "Publications",
    items: [
      {
        label: "Writeups",
        children: [
          {
            label: "Hack The Box",
            children: [
              {
                label: "Machines",
                children: [
                  { label: "Artificial", href: "/writeups/Artificial" },
                  { label: "Cap", href: "/writeups/Cap" },
                  { label: "Editor", href: "/writeups/Editor" },
                  { label: "EscapeTwo", href: "/writeups/EscapeTwo" },
                  { label: "Expressway", href: "/writeups/Expressway" },
                  { label: "Planning", href: "/writeups/Planning" },
                  { label: "Reactor", href: "/writeups/Reactor" },
                  { label: "Other Machines", href: "/writeups/Other-Machines" },
                ],
              },
            ],
          },
        ],
      },
      {
        label: "Notes",
        children: [
          {
            label: "Pentesting",
            children: [
              { label: "Kerberos Delegation", href: "/notes/kerberos-delegation" },
            ],
          },
        ],
      },
    ],
  },
  {
    label: null,
    items: [
      { label: "Contact", href: "/contact" },
    ],
  },
];

function isGroup(node: NavNode): node is NavGroup {
  return Array.isArray((node as NavGroup).children);
}

function isActive(href: string, currentPath: string): boolean {
  if (href === "/") return currentPath === "/";
  return currentPath === href || currentPath.startsWith(href + "/");
}

function isAncestorActive(node: NavGroup, currentPath: string): boolean {
  return node.children.some((child) => {
    if (isGroup(child)) return isAncestorActive(child, currentPath);
    return child.href ? isActive(child.href, currentPath) : false;
  });
}

// ─── Individual collapsible group ────────────────────────────────
function NavGroupItem({
  node,
  currentPath,
  depth = 0,
}: {
  node: NavGroup;
  currentPath: string;
  depth?: number;
}) {
  const ancestorActive = isAncestorActive(node, currentPath);
  const [open, setOpen] = useState(ancestorActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={[
          "w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded-md text-sm transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          depth === 0 ? "" : "pl-4",
          ancestorActive
            ? "text-primary font-medium"
            : "text-muted-foreground",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-expanded={open}
      >
        <span>{node.label}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`size-3.5 shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      {open && (
        <div className={`mt-0.5 ml-3 border-l border-border/60 pl-2 space-y-0.5`}>
          {node.children.map((child, i) =>
            isGroup(child) ? (
              <NavGroupItem
                key={i}
                node={child}
                currentPath={currentPath}
                depth={depth + 1}
              />
            ) : (
              <a
                key={i}
                href={child.href}
                aria-current={isActive(child.href, currentPath) ? "page" : undefined}
                className={[
                  "flex items-center px-2 py-1.5 rounded-md text-xs transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive(child.href, currentPath)
                    ? "text-primary font-medium bg-primary/10 border-l-2 border-primary -ml-px pl-[calc(0.5rem+1px)]"
                    : "text-muted-foreground",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {child.label}
              </a>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ─── Root sidebar nav ─────────────────────────────────────────────
export default function SidebarNav({ currentPath }: { currentPath: string }) {
  const path = currentPath.replace(/\/$/, "") || "/";

  return (
    <nav className="flex-1 flex flex-col gap-1 py-2" aria-label="Sidebar navigation">
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi} className={gi > 0 ? "mt-4" : ""}>
          {group.label && (
            <p className="px-2 mb-1 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">
              {group.label}
            </p>
          )}
          {group.items.map((item, ii) =>
            isGroup(item) ? (
              <NavGroupItem key={ii} node={item} currentPath={path} />
            ) : (
              <a
                key={ii}
                href={item.href}
                aria-current={isActive(item.href, path) ? "page" : undefined}
                className={[
                  "flex items-center px-2 py-1.5 rounded-md text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive(item.href, path)
                    ? "font-medium text-primary bg-primary/10 border-l-2 border-primary -ml-px pl-[calc(0.5rem+1px)]"
                    : "text-muted-foreground",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {item.label}
              </a>
            )
          )}
        </div>
      ))}
    </nav>
  );
}
