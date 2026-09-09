"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

// Cards collaborate through this context so any CardHeader can toggle the
// matching CardContent/CardFooter. Consumers opt out with `collapsible={false}`
// on the Card (e.g. tiny tile cards where the click target adds noise).
type CardCtx = { open: boolean; toggle: () => void; collapsible: boolean };
const CardContext = React.createContext<CardCtx | null>(null);

function Card({
  className,
  size = "default",
  collapsible = true,
  defaultOpen = true,
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm";
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const value = React.useMemo<CardCtx>(
    () => ({ open, toggle: () => setOpen((o) => !o), collapsible }),
    [open, collapsible],
  );
  return (
    <CardContext.Provider value={value}>
      <div
        data-slot="card"
        data-size={size}
        data-state={open ? "open" : "closed"}
        data-collapsible={collapsible ? "true" : "false"}
        className={cn(
          "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
          className,
        )}
        {...props}
      />
    </CardContext.Provider>
  );
}

function CardHeader({
  className,
  children,
  onClick,
  ...props
}: React.ComponentProps<"div">) {
  const ctx = React.useContext(CardContext);
  const clickable = !!ctx?.collapsible;
  const isOpen = ctx?.open ?? true;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onClick?.(e);
    if (!clickable || e.defaultPrevented) return;
    // Don't toggle when the user clicks an interactive descendant
    // (e.g. a button, link, or form control living inside CardAction).
    const t = e.target as HTMLElement;
    if (t !== e.currentTarget) {
      const interactive = t.closest(
        "button, a, input, select, textarea, label, [role='button']",
      );
      if (
        interactive &&
        interactive !== e.currentTarget &&
        e.currentTarget.contains(interactive)
      ) {
        return;
      }
    }
    ctx?.toggle();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!clickable) return;
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      ctx?.toggle();
    }
  };

  return (
    <div
      data-slot="card-header"
      onClick={handleClick}
      onKeyDown={handleKey}
      tabIndex={clickable ? 0 : undefined}
      role={clickable ? "button" : undefined}
      aria-expanded={clickable ? isOpen : undefined}
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        clickable &&
          "relative cursor-pointer select-none pr-9 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      {children}
      {clickable && (
        <ChevronDown
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform",
            !isOpen && "-rotate-90",
          )}
        />
      )}
    </div>
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  const ctx = React.useContext(CardContext);
  if (ctx && !ctx.open) return null;
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  const ctx = React.useContext(CardContext);
  if (ctx && !ctx.open) return null;
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
