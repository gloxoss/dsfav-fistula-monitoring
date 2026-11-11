"use client";

import * as Primitive from "radix-ui/tabs";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...values: Parameters<typeof clsx>) => twMerge(clsx(...values));
export const Tabs = Primitive.Root;
export const TabsList = ({ className, ...props }: React.ComponentProps<typeof Primitive.List>) => (
  <Primitive.List className={cn("inline-flex min-h-11 items-center gap-1 rounded-full bg-well p-1", className)} {...props} />
);
export const TabsTrigger = ({ className, ...props }: React.ComponentProps<typeof Primitive.Trigger>) => (
  <Primitive.Trigger className={cn("min-h-11 rounded-full px-4 text-sm text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 data-[state=active]:bg-surface data-[state=active]:text-text-primary", className)} {...props} />
);
export const TabsContent = ({ className, ...props }: React.ComponentProps<typeof Primitive.Content>) => (
  <Primitive.Content className={cn("focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2", className)} {...props} />
);
