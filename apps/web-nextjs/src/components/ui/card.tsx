import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export type CardVariant = "default" | "dark" | "well";

export interface CardProps<T extends ElementType = "div"> {
  as?: T;
  variant?: CardVariant;
  children: ReactNode;
  className?: string;
}

export function Card<T extends ElementType = "div">({
  as,
  variant = "default",
  children,
  className = "",
  ...rest
}: CardProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof CardProps<T>>) {
  const Component = as || "div";

  const variantStyles: Record<CardVariant, string> = {
    default: "bg-surface text-text-primary rounded-[28px] p-6 shadow-[0_1px_2px_rgba(20,27,52,0.04)]",
    dark: "bg-dark text-white rounded-[28px] p-6 shadow-sm",
    well: "bg-well text-text-primary rounded-[20px] p-4",
  };

  return (
    <Component
      className={`${variantStyles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </Component>
  );
}
