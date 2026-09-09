import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LedgerAmountTone = "revenue" | "expense" | "neutral";

const toneClass: Record<LedgerAmountTone, string> = {
  revenue: "text-emerald-700 dark:text-emerald-300",
  expense: "text-red-700 dark:text-red-300",
  neutral: "text-foreground",
};

const toneSign: Record<LedgerAmountTone, string> = {
  revenue: "+",
  expense: "−",
  neutral: "",
};

export type LedgerAmount = {
  value: string;
  tone?: LedgerAmountTone;
  showSign?: boolean;
  subtext?: ReactNode;
};

export type LedgerRowProps = {
  href?: string;
  title: ReactNode;
  badges?: ReactNode;
  meta?: ReactNode;
  submeta?: ReactNode;
  amount?: LedgerAmount;
  status?: ReactNode;
  actions?: ReactNode;
};

export function LedgerRow({
  href,
  title,
  badges,
  meta,
  submeta,
  amount,
  status,
  actions,
}: LedgerRowProps) {
  const tone: LedgerAmountTone = amount?.tone ?? "neutral";
  const sign = amount?.showSign ? toneSign[tone] : "";

  const titleContent = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="font-medium">{title}</div>
        {badges}
      </div>
      {meta && (
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {meta}
        </div>
      )}
      {submeta && (
        <div className="mt-0.5 text-[10px] text-muted-foreground">{submeta}</div>
      )}
    </>
  );

  return (
    <li className="group hover:bg-muted/40">
      <div className="flex items-start gap-3 p-3">
        {href ? (
          <Link href={href} className="min-w-0 flex-1">
            {titleContent}
          </Link>
        ) : (
          <div className="min-w-0 flex-1">{titleContent}</div>
        )}

        {amount && (
          <div className="text-right text-xs">
            <div
              className={cn(
                "font-mono text-sm font-semibold",
                toneClass[tone],
              )}
            >
              {sign}
              {amount.value}
            </div>
            {amount.subtext && (
              <div className="mt-0.5 text-muted-foreground">
                {amount.subtext}
              </div>
            )}
          </div>
        )}

        {status && (
          <div className="flex flex-col items-end gap-1 text-xs">{status}</div>
        )}

        {actions && (
          <div className="flex items-center gap-1">{actions}</div>
        )}
      </div>
    </li>
  );
}

export type LedgerListProps = {
  title: ReactNode;
  count?: number;
  icon?: LucideIcon;
  action?: ReactNode;
  headerMeta?: ReactNode;
  empty?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function LedgerList({
  title,
  count,
  icon: Icon,
  action,
  headerMeta,
  empty,
  className,
  children,
}: LedgerListProps) {
  const childArray = Array.isArray(children) ? children : [children];
  const hasRows = childArray.some((c) => c !== null && c !== undefined && c !== false);

  return (
    <Card className={className} collapsible={false}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <span>{title}</span>
          {typeof count === "number" && (
            <span className="text-muted-foreground">({count})</span>
          )}
          {headerMeta && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {headerMeta}
            </span>
          )}
        </CardTitle>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="p-0">
        {!hasRows ? (
          <div className="p-6 text-sm text-muted-foreground">
            {empty ?? "Nothing here yet."}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">{children}</ul>
        )}
      </CardContent>
    </Card>
  );
}
