"use client";

import * as React from "react";
import { type VariantProps, cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border-blue-500/60 bg-blue-500 text-white shadow-[0_0_24px_rgba(59,130,246,0.22)] hover:bg-blue-400",
        secondary:
          "border-slate-700 bg-slate-900/70 text-slate-100 hover:border-slate-500 hover:bg-slate-800",
        ghost: "border-transparent text-slate-300 hover:bg-slate-800/80 hover:text-white",
        danger:
          "border-red-500/50 bg-red-500/15 text-red-100 hover:bg-red-500/25",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        icon: "h-9 w-9 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
