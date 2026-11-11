import type { ButtonHTMLAttributes, ReactNode } from "react";

export type PillButtonVariant = "primary" | "secondary" | "dark-arrow" | "ghost" | "danger";
export type PillButtonSize = "sm" | "md" | "lg" | "icon";

export interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillButtonVariant;
  size?: PillButtonSize;
  icon?: ReactNode;
  children?: ReactNode;
  isLoading?: boolean;
}

export function PillButton({
  variant = "primary",
  size = "md",
  icon,
  children,
  isLoading = false,
  className = "",
  disabled,
  ...props
}: PillButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium transition select-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClasses: Record<PillButtonSize, string> = {
    sm: "px-4 py-1.5 text-xs rounded-full min-h-[32px] gap-1.5",
    md: "px-5 py-2.5 text-sm rounded-full min-h-[44px] gap-2",
    lg: "px-6 py-3 text-base rounded-full min-h-[48px] gap-2.5",
    icon: "w-10 h-10 rounded-full p-2 shrink-0",
  };

  const variantClasses: Record<PillButtonVariant, string> = {
    primary: "bg-primary text-white hover:opacity-95 active:scale-[0.99] shadow-sm",
    secondary: "bg-surface text-text-primary border border-hairline hover:bg-well active:scale-[0.99]",
    "dark-arrow": "bg-dark text-cyan hover:opacity-90 active:scale-[0.98] w-10 h-10 rounded-full",
    ghost: "bg-transparent text-text-secondary hover:text-text-primary hover:bg-well",
    danger: "bg-critical-tint text-critical-text hover:bg-critical-tint/80 border border-critical-text/20",
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
