"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { ClipboardList, History, GraduationCap, ShieldCheck, Users } from "lucide-react";
import { getRoleLabel, isRouteAllowedForRole, type UserRole } from "@/libs/auth/session";
import { UserMenu } from "./user-menu";

export interface NavItemConfig {
  href: string;
  label: string;
  icon: (active: boolean) => ReactNode;
  roles?: UserRole[];
}

export interface SidebarUser {
  id?: string;
  role: UserRole;
  roleLabel?: string;
}

const MENU_ITEMS: NavItemConfig[] = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    roles: ["NURSE", "NEPHROLOGIST"],
    icon: (active) => (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="9" rx="2" />
        <rect x="14" y="3" width="7" height="5" rx="2" />
        <rect x="14" y="12" width="7" height="9" rx="2" />
        <rect x="3" y="16" width="7" height="5" rx="2" />
      </svg>
    ),
  },
  {
    href: "/capture",
    label: "Acquisition",
    roles: ["NURSE"],
    icon: (active) => (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    href: "/patients",
    label: "Patients",
    roles: ["NURSE", "NEPHROLOGIST"],
    icon: (active) => (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/training-bench",
    label: "Banc d'essai",
    roles: ["INTERN"],
    icon: (active) => (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
      </svg>
    ),
  },
];

const AUTRES_ITEMS: NavItemConfig[] = [
  {
    href: "/notes",
    label: "Notes et suivis",
    roles: ["NEPHROLOGIST"],
    icon: (active) => <ClipboardList className="w-5 h-5 shrink-0" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />,
  },
  {
    href: "/baseline-history",
    label: "Historique des références",
    roles: ["NEPHROLOGIST"],
    icon: (active) => <History className="w-5 h-5 shrink-0" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />,
  },
  {
    href: "/bench-history",
    label: "Historique du banc",
    roles: ["NEPHROLOGIST", "INTERN"],
    icon: (active) => <GraduationCap className="w-5 h-5 shrink-0" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />,
  },
  {
    href: "/devices",
    label: "Appareils",
    roles: ["NURSE", "NEPHROLOGIST", "ADMIN"],
    icon: (active) => (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <path d="M12 18h.01" />
      </svg>
    ),
  },
  {
    href: "/settings/clinical",
    label: "Paramètres cliniques",
    roles: ["NEPHROLOGIST", "ADMIN"],
    icon: (active) => (
      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
  },
  {
    href: "/admin/audit",
    label: "Journal d’audit",
    roles: ["NEPHROLOGIST", "ADMIN"],
    icon: (active) => <ShieldCheck className="w-5 h-5 shrink-0" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />,
  },
  {
    href: "/admin/users",
    label: "Utilisateurs",
    roles: ["ADMIN"],
    icon: (active) => <Users className="w-5 h-5 shrink-0" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />,
  },
];

export interface SidebarProps {
  user?: SidebarUser;
}

function useForbiddenRedirect() {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("popstate", onChange);
      return () => window.removeEventListener("popstate", onChange);
    },
    () => new URLSearchParams(window.location.search).get("forbidden") === "1",
    () => false,
  );
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SidebarUser>();
  const currentRole = user?.role ?? sessionUser?.role;
  const forbiddenRedirect = useForbiddenRedirect();

  useEffect(() => {
    void fetch("/api/session").then(async (response) => {
      if (response.ok) {
        const data = await response.json();
        setSessionUser(data.user);
      }
    });
  }, []);

  const logout = async () => {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
  };

  const navItems = MENU_ITEMS.filter((item) => {
    if (!item.roles) return true;
    if (!currentRole) return true;
    return item.roles.includes(currentRole);
  });

  const autres = AUTRES_ITEMS.filter((item) => {
    if (!item.roles) return true;
    if (!currentRole) return true;
    return item.roles.includes(currentRole);
  });

  return (
    <aside
      aria-label="Navigation principale"
      className="sticky top-0 h-screen w-20 lg:w-[248px] bg-sidebar border-r border-hairline flex flex-col shrink-0 p-3 lg:p-4 select-none"
    >
      {/* Navigation scrolls inside the sidebar when the window is short; the profile below stays pinned */}
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-9 h-9 rounded-[14px] bg-primary flex items-center justify-center text-white font-bold text-sm tracking-wider shrink-0 shadow-xs">
            DS
          </div>
          <div className="hidden lg:flex flex-col">
            <span className="font-semibold text-base tracking-tight text-text-primary leading-none">
              DSFAV
            </span>
            <span className="text-[11px] text-text-label font-normal mt-0.5">
              Suivi dialytique
            </span>
          </div>
        </div>

        {forbiddenRedirect ? (
          <p
            role="alert"
            className="rounded-[14px] bg-critical-tint p-2 text-xs text-critical-text"
          >
            Accès refusé pour ce profil.
          </p>
        ) : null}

        {/* Navigation Group: Principal */}
        <nav aria-label="Menu principal" className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const isAllowed = currentRole ? isRouteAllowedForRole(item.href, currentRole) : true;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-disabled={!isAllowed}
                className={`w-full flex items-center justify-center lg:justify-between px-3 py-2.5 rounded-[14px] text-sm transition font-medium ${
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : isAllowed
                    ? "text-text-secondary hover:text-text-primary hover:bg-well"
                    : "opacity-40 text-text-muted hover:bg-transparent cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon(isActive)}
                  <span className="hidden lg:inline truncate">{item.label}</span>
                </div>
                {isActive ? (
                  <svg className="hidden lg:block w-4 h-4 ml-1 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Navigation Group: Autres */}
        {autres.length > 0 ? (
          <div className="space-y-1 pt-2">
            <p className="hidden lg:block px-3 text-[11px] font-semibold tracking-wider text-text-label uppercase">
              Autres
            </p>
            <nav aria-label="Autres options" className="space-y-1">
              {autres.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`w-full flex items-center justify-center lg:justify-between px-3 py-2.5 rounded-[14px] text-sm transition font-medium ${
                      isActive
                        ? "bg-primary text-white shadow-sm"
                        : "text-text-secondary hover:text-text-primary hover:bg-well"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon(isActive)}
                      <span className="hidden lg:inline truncate">{item.label}</span>
                    </div>
                    {isActive ? (
                      <svg className="hidden lg:block w-4 h-4 ml-1 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : null}
      </div>

      {/* User Card (strictly pseudonymous per the project rules, README rule 2) */}
      <div className="shrink-0 border-t border-hairline pt-3 mt-3">
        <UserMenu
          initials={currentRole === "NURSE" ? "INF" : currentRole === "INTERN" ? "INT" : currentRole === "ADMIN" ? "ADM" : currentRole === "NEPHROLOGIST" ? "NEP" : "…"}
          roleLabel={user?.roleLabel ?? (user?.role ? getRoleLabel(user.role) : sessionUser?.role ? getRoleLabel(sessionUser.role) : "Chargement du profil")}
          userId={user?.id ?? sessionUser?.id ?? ""}
          onLogout={logout}
        />
      </div>
    </aside>
  );
}
