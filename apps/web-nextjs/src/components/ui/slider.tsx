"use client";

import "./resize-observer-fallback";
import * as Primitive from "radix-ui/slider";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...values: Parameters<typeof clsx>) => twMerge(clsx(...values));
export const Slider = ({ className, "aria-label": ariaLabel, ...props }: React.ComponentProps<typeof Primitive.Root>) => (
  <Primitive.Root className={cn("relative flex h-11 w-full touch-none select-none items-center", className)} {...props}>
    <Primitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-well"><Primitive.Range className="absolute h-full bg-primary" /></Primitive.Track>
    <Primitive.Thumb aria-label={ariaLabel} className="block h-6 w-6 rounded-full border-2 border-primary bg-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none" />
  </Primitive.Root>
);
