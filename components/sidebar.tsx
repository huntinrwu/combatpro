"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  Eye,
  LogOut,
  Menu,
  ShieldCheck,
  UserCircle,
  X,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { PLATFORM_ROLES, ROLE_LABELS, type PlatformRole } from "@/lib/auth/roles";
import { setViewAsRole } from "@/lib/auth/view-as";
import type { Module } from "@/lib/modules";
import { MODULES, MODULE_SECTIONS } from "@/lib/modules";
import { cn } from "@/lib/utils";

type SidebarUser = {
  email: string;
  fullName: string | null;
  isStaff: boolean;
  actualIsStaff: boolean;
  isAdmin: boolean;
  actualIsAdmin: boolean;
  viewAsRole: PlatformRole | null;
  viewAsEmployee: boolean;
};

const COLLAPSED_KEY = "cp:sidebar:collapsed";

function isActive(pathname: string, slug: string): boolean {
  if (pathname === `/${slug}`) return true;
  return pathname.startsWith(`/${slug}/`);
}

export function Sidebar({
  user,
  visibleSlugs,
}: {
  user: SidebarUser | null;
  visibleSlugs: string[];
}) {
  const pathname = usePathname() ?? "/";
  // `collapsed` is a desktop-only concern (icon-only rail). On mobile the
  // sidebar is either fully-expanded in an overlay drawer, or entirely
  // hidden — `mobileOpen` controls that.
  const [collapsed, setCollapsedState] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Hydrate collapsed state from localStorage after mount. Writes happen
  // eagerly inside `setCollapsed` so we don't need a separate save effect.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(COLLAPSED_KEY) === "1") setCollapsedState(true);
    } catch {}
  }, []);

  const setCollapsed = (value: boolean) => {
    setCollapsedState(value);
    try {
      localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
    } catch {}
  };

  // Close the mobile drawer whenever the user navigates.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  // Public fan pages, control room, and auth-flow pages get their own chrome.
  if (
    pathname.startsWith("/e/") ||
    pathname.startsWith("/live/") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/pending"
  ) {
    return null;
  }

  const visibleSet = new Set(visibleSlugs);
  const modules = MODULES.filter((m) => visibleSet.has(m.slug));
  const grouped: Record<string, Module[]> = { operations: [], regulatory: [], business: [] };
  for (const m of modules) grouped[m.section].push(m);

  // When the mobile drawer is open, always show labels; otherwise defer to
  // the desktop `collapsed` state.
  const iconOnly = collapsed && !mobileOpen;

  return (
    <>
      {/* Mobile hamburger — always floats top-left on narrow viewports. */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-background/95 text-foreground shadow-sm backdrop-blur md:hidden print:hidden"
        aria-label="Open menu"
        aria-expanded={mobileOpen}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop dims the page behind the drawer. */}
      {mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          aria-label="Close menu"
          tabIndex={-1}
        />
      )}

    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-border/60 bg-background/95 backdrop-blur transition-[width] duration-150 print:hidden",
        // Desktop: sticky column, width driven by `collapsed`.
        "md:sticky md:top-0 md:z-30",
        collapsed ? "md:w-14" : "md:w-60",
        // Mobile: fixed drawer when open, hidden otherwise.
        mobileOpen ? "fixed left-0 top-0 z-50 w-64" : "hidden md:flex",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b border-border/60 px-3",
          iconOnly ? "justify-center" : "justify-between",
        )}
      >
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 font-heading text-sm font-semibold tracking-wide",
            iconOnly && "justify-center",
          )}
          title="CombatPro"
        >
          <Image src="/logo-mark.svg" alt="" width={22} height={22} priority />
          {!iconOnly && <span>CombatPro</span>}
        </Link>
        {/* Mobile close — only inside the drawer. */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground md:hidden"
          title="Close"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        {/* Desktop collapse — hidden on mobile since the drawer is always expanded. */}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="hidden md:flex rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            title="Collapse"
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {iconOnly && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            title="Expand"
            aria-label="Expand sidebar"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        )}

        {MODULE_SECTIONS.map((section) => {
          const items = grouped[section.key] ?? [];
          if (items.length === 0) return null;
          return (
            <div key={section.key} className="mb-3">
              {!iconOnly && (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {section.title}
                </p>
              )}
              {iconOnly && <div className="mx-3 mb-1 border-t border-border/40" />}
              <ul className="space-y-0.5 px-2">
                {items.map((m) => {
                  const active = isActive(pathname, m.slug);
                  return (
                    <li key={m.slug}>
                      <Link
                        href={`/${m.slug}`}
                        title={iconOnly ? m.title : undefined}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          iconOnly && "justify-center",
                          active
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <m.Icon className="h-4 w-4 shrink-0" />
                        {!iconOnly && <span className="truncate">{m.title}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {user?.actualIsStaff && (
          <div className="mb-3">
            {!iconOnly && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Staff
              </p>
            )}
            {iconOnly && <div className="mx-3 mb-1 border-t border-border/40" />}
            <ul className="space-y-0.5 px-2">
              <li>
                <Link
                  href={user.isAdmin ? "/admin/access-requests" : "/admin/persons"}
                  title={iconOnly ? "Admin" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    iconOnly && "justify-center",
                    pathname.startsWith("/admin")
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  {!iconOnly && <span className="truncate">Admin</span>}
                </Link>
              </li>
              <li>
                <ViewAsPicker
                  collapsed={iconOnly}
                  currentRole={user.viewAsRole}
                  currentEmployee={user.viewAsEmployee}
                  showEmployee={user.actualIsAdmin}
                />
              </li>
            </ul>
          </div>
        )}
      </nav>

      <div
        className={cn(
          "border-t border-border/60 p-2",
          iconOnly ? "flex flex-col items-center gap-2" : "space-y-2",
        )}
      >
        {!iconOnly && <ThemeToggle />}
        {user ? (
          <UserMenu user={user} collapsed={iconOnly} />
        ) : (
          <div className={cn("flex", iconOnly ? "flex-col gap-1" : "gap-1")}>
            <Link
              href="/login"
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              {iconOnly ? "In" : "Sign in"}
            </Link>
            {!iconOnly && (
              <Link
                href="/signup"
                className="rounded-md border border-border/60 px-2 py-1 text-xs text-foreground hover:bg-muted/60"
              >
                Sign up
              </Link>
            )}
          </div>
        )}
      </div>
    </aside>
    </>
  );
}

function ViewAsPicker({
  collapsed,
  currentRole,
  currentEmployee,
  showEmployee,
}: {
  collapsed: boolean;
  currentRole: PlatformRole | null;
  currentEmployee: boolean;
  showEmployee: boolean;
}) {
  const label = currentRole
    ? `Viewing as ${ROLE_LABELS[currentRole]}`
    : currentEmployee
      ? "Viewing as Employee"
      : "View as…";
  const active = currentRole !== null || currentEmployee;
  const defaultLabel = showEmployee ? "Admin (default)" : "Staff (default)";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={collapsed ? label : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          collapsed && "justify-center",
          active
            ? "bg-amber-500/15 text-amber-900 dark:text-amber-200"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <Eye className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate text-left">{label}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="min-w-[200px] p-1">
        <form action={setViewAsRole}>
          <input type="hidden" name="role" value="" />
          <button
            type="submit"
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60",
              !active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span>{defaultLabel}</span>
            {!active && <span className="text-xs">✓</span>}
          </button>
        </form>
        {showEmployee && (
          <>
            <div className="my-1 border-t border-border/60" />
            <form action={setViewAsRole}>
              <input type="hidden" name="role" value="employee" />
              <button
                type="submit"
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60",
                  currentEmployee ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <span>Employee</span>
                {currentEmployee && <span className="text-xs">✓</span>}
              </button>
            </form>
          </>
        )}
        <div className="my-1 border-t border-border/60" />
        {PLATFORM_ROLES.map((role) => (
          <form key={role} action={setViewAsRole}>
            <input type="hidden" name="role" value={role} />
            <button
              type="submit"
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60",
                currentRole === role ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span>{ROLE_LABELS[role]}</span>
              {currentRole === role && <span className="text-xs">✓</span>}
            </button>
          </form>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ user, collapsed }: { user: SidebarUser; collapsed: boolean }) {
  const initials =
    (user.fullName ?? user.email)
      .split(/\s+/)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || user.email[0].toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted/60",
          collapsed && "w-8 justify-center border-0 px-0",
        )}
        title={user.email}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
          {initials}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate text-left">
            {user.fullName ?? user.email}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="min-w-[220px] p-2">
        <div className="border-b border-border/60 px-2 pb-2 text-xs text-muted-foreground">
          {user.email}
          {user.isStaff && (
            <span className="ml-2 rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
              Staff
            </span>
          )}
        </div>
        <Link
          href="/me"
          className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <UserCircle className="h-3.5 w-3.5" />
          My profile
        </Link>
        {user.isStaff && (
          <Link
            href={user.isAdmin ? "/admin/access-requests" : "/admin/persons"}
            className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin
          </Link>
        )}
        <form action="/logout" method="post" className="mt-1">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
