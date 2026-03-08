"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1", className)}>
      <ol className="flex items-center gap-1">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3 text-muted-foreground/30" aria-hidden />}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-[12px] text-muted-foreground/60 transition-colors hover:text-foreground truncate max-w-[150px]"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    "text-[12px] truncate max-w-[200px]",
                    isLast ? "text-foreground/80 font-medium" : "text-muted-foreground/60"
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
