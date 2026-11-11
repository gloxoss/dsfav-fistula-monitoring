"use client";

import * as Primitive from "radix-ui/toggle-group";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...values: Parameters<typeof clsx>) => twMerge(clsx(...values));
export const ToggleGroup = ({ className, ...props }: React.ComponentProps<typeof Primitive.Root>) => (
  <Primitive.Root className={cn("inline-flex flex-wrap gap-2", className)} {...props} />
);
export const ToggleGroupItem = ({ className, ...props }: React.ComponentProps<typeof Primitive.Item>) => (
  <Primitive.Item className={cn("min-h-11 min-w-11 rounded-full px-4 text-sm font-medium text-text-secondary transition hover:bg-hairline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 data-[state=on]:bg-primary data-[state=on]:text-white disabled:cursor-not-allowed disabled:opacity-60", className)} {...props} />
);
