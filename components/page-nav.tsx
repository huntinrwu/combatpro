"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronRight, Home } from "lucide-react";

import { Button } from "@/components/ui/button";

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  "access-requests": "Access requests",
  bouts: "Bouts",
  cashflow: "Cash flow",
  commissions: "Commissions",
  edit: "Edit",
  events: "Events",
  fighters: "Fighters",
  finalize: "Finalize",
  financials: "Financials",
  gyms: "Gyms",
  medical: "Medical",
  new: "New",
  officials: "Officials",
  payments: "Payments",
  promotions: "Promotions",
  records: "Records",
  registry: "Registry",
  regulatory: "Regulatory",
  rules: "Rules",
  "run-of-show": "Run of show",
  sb: "Sanctioning bodies",
  sponsors: "Sponsors",
  submit: "Submit",
  vendors: "Vendors",
  "weigh-ins": "Weigh-ins",
  "weight-classes": "Weight classes",
};

// When a segment is a dynamic ID (UUID/slug), label it using its parent.
const CHILD_LABEL: Record<string, string> = {
  bouts: "Bout",
  commissions: "Commission",
  events: "Event",
  fighters: "Fighter",
  gyms: "Gym",
  officials: "Official",
  promotions: "Promotion",
  records: "Record",
  rules: "Ruleset",
  sb: "Sanctioning body",
  sponsors: "Sponsor",
  vendors: "Vendor",
};

function humanize(segment: string): string {
  return segment
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function labelFor(segments: string[], i: number): string {
  const seg = segments[i];
  if (SEGMENT_LABELS[seg]) return SEGMENT_LABELS[seg];
  const parent = segments[i - 1];
  if (parent && CHILD_LABEL[parent]) return CHILD_LABEL[parent];
  return humanize(seg);
}

export function PageNav() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const segments = pathname.split("/").filter(Boolean);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => router.back()}
        aria-label="Go back"
        title="Back"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => router.forward()}
        aria-label="Go forward"
        title="Forward"
      >
        Forward
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>

      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-xs text-muted-foreground"
      >
        <Link
          href="/"
          className="flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted/60 hover:text-foreground"
          title="Home"
        >
          <Home className="h-3.5 w-3.5" />
          <span>Home</span>
        </Link>
        {segments.map((seg, i) => {
          const href = "/" + segments.slice(0, i + 1).join("/");
          const label = labelFor(segments, i);
          const isLast = i === segments.length - 1;
          return (
            <span key={href} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 opacity-50" />
              {isLast ? (
                <span className="rounded-md px-1.5 py-1 font-medium text-foreground">
                  {label}
                </span>
              ) : (
                <Link
                  href={href}
                  className="rounded-md px-1.5 py-1 hover:bg-muted/60 hover:text-foreground"
                >
                  {label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
