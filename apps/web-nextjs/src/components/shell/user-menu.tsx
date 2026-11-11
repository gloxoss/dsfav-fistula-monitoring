"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronUp, LogOut } from "lucide-react";

export interface UserMenuProps {
  initials: string;
  roleLabel: string;
  userId: string;
  onLogout: () => void;
}

/**
 * Profile control pinned at the bottom of the sidebar. One button at every width: the avatar alone when the
 * sidebar is collapsed, avatar + role + id when it is open. It opens a small menu with the logout action.
 * Identity is the role and a pseudonymous account id only (no personal data).
 */
export function UserMenu({ initials, roleLabel, userId, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Menu du profil, ${roleLabel}`}
        title={`${roleLabel} · ${userId}`}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-[14px] p-2 text-left transition-colors hover:bg-well focus-visible:ring-2 focus-visible:ring-primary lg:justify-start"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-xs font-bold text-primary">
          {initials}
        </span>
        <span className="hidden min-w-0 flex-1 flex-col leading-tight lg:flex">
          <span className="truncate text-sm font-semibold text-text-primary">{roleLabel}</span>
          <span className="truncate text-xs text-text-secondary">{userId}</span>
        </span>
        <ChevronUp
          className={`hidden h-4 w-4 shrink-0 text-text-muted transition-transform lg:block ${open ? "" : "rotate-180"}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Profil"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
          className="absolute bottom-full left-0 z-50 mb-2 w-60 rounded-[16px] border border-hairline bg-surface p-2 shadow-lg"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-text-primary">{roleLabel}</p>
            <p className="font-mono text-xs text-text-secondary">{userId}</p>
          </div>
          <div className="my-1 border-t border-hairline" />
          <button
            type="button"
            role="menuitem"
            autoFocus
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-[12px] px-3 text-sm font-medium text-text-primary transition-colors hover:bg-well focus-visible:ring-2 focus-visible:ring-primary"
          >
            <LogOut className="h-4 w-4 text-text-secondary" aria-hidden="true" />
            Se déconnecter
          </button>
        </div>
      ) : null}
    </div>
  );
}
