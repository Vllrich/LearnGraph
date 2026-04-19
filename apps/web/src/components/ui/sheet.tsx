"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Responsive Sheet surface built on Radix Dialog.
 *
 * - Desktop: slides in from the right as a fixed-width side panel.
 * - Mobile:  slides up from the bottom as a rounded bottom sheet.
 *
 * Accessibility, focus trap, escape-to-close, and backdrop click are inherited
 * from Radix Dialog. Animations are driven by the `data-[state=open|closed]`
 * attributes Radix sets on the overlay and content nodes.
 */

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200",
        "data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

type SheetSide = "right" | "bottom";

type SheetContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  /**
   * Where the sheet docks. Defaults to auto-responsive: `bottom` under
   * the `sm` breakpoint and `right` at and above it.
   */
  side?: SheetSide | "responsive";
  showCloseButton?: boolean;
};

function SheetContent({
  className,
  children,
  side = "responsive",
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  const sideClasses =
    side === "right"
      ? "inset-y-0 right-0 h-dvh w-full max-w-[420px] border-l translate-x-0 data-[state=closed]:translate-x-full"
      : side === "bottom"
        ? "inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-2xl border-t translate-y-0 data-[state=closed]:translate-y-full"
        : // responsive: bottom sheet on mobile, right side panel on sm+
          "inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-2xl border-t sm:inset-y-0 sm:right-0 sm:left-auto sm:h-dvh sm:max-h-none sm:w-full sm:max-w-[440px] sm:rounded-none sm:border-t-0 sm:border-l data-[state=open]:translate-y-0 data-[state=closed]:translate-y-full sm:data-[state=open]:translate-x-0 sm:data-[state=closed]:translate-x-full sm:data-[state=closed]:translate-y-0";

  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-0 bg-background shadow-xl outline-none",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          sideClasses,
          className,
        )}
        {...props}
      >
        {/* Drag handle — only visible when the sheet is docked to the bottom
            (mobile-only when `side` is "responsive"). Purely decorative. */}
        {side !== "right" && (
          <div
            aria-hidden
            className={cn(
              "mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25",
              side === "responsive" && "sm:hidden",
            )}
          />
        )}
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="sheet-close"
            className="absolute top-3 right-3 rounded-md p-1.5 text-muted-foreground/70 ring-offset-background transition-colors hover:bg-muted hover:text-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex flex-col gap-1 border-b border-border/30 px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("pr-8 text-sm font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("flex-1 overflow-y-auto px-5 py-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "flex shrink-0 flex-col gap-2 border-t border-border/30 px-5 py-3 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
