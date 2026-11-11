"use client";

import * as Primitive from "radix-ui/dialog";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...values: Parameters<typeof clsx>) => twMerge(clsx(...values));

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogPortal = Primitive.Portal;
export const DialogClose = Primitive.Close;
export const DialogOverlay = ({ className, ...props }: React.ComponentProps<typeof Primitive.Overlay>) => (
  <Primitive.Overlay className={cn("fixed inset-0 z-50 bg-dark/40", className)} {...props} />
);
export const DialogContent = ({ className, ...props }: React.ComponentProps<typeof Primitive.Content>) => (
  <Primitive.Portal>
    <DialogOverlay />
    <Primitive.Content className={cn("fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-surface p-6 shadow-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2", className)} {...props} />
  </Primitive.Portal>
);
export const DialogTitle = ({ className, ...props }: React.ComponentProps<typeof Primitive.Title>) => (
  <Primitive.Title className={cn("text-lg font-semibold text-text-primary", className)} {...props} />
);
export const DialogDescription = ({ className, ...props }: React.ComponentProps<typeof Primitive.Description>) => (
  <Primitive.Description className={cn("text-sm text-text-secondary", className)} {...props} />
);
