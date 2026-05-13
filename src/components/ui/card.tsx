import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[#20304A] bg-[#101B2D]/80 shadow-[0_18px_60px_rgba(0,0,0,0.22)]",
        className,
      )}
      {...props}
    />
  );
}
