import Link from "next/link";

import { MODULE_SECTIONS, visibleModules } from "@/lib/modules";
import type { PlatformRole } from "@/lib/auth/roles";

export function ModulesStrip({
  approvedRoles,
  isStaff,
}: {
  approvedRoles: PlatformRole[];
  isStaff: boolean;
}) {
  const modules = visibleModules(approvedRoles, isStaff);
  const grouped: Record<string, typeof modules> = {
    operations: [],
    regulatory: [],
    business: [],
  };
  for (const m of modules) grouped[m.section].push(m);

  return (
    <div className="space-y-6">
      {MODULE_SECTIONS.map((section) => {
        const items = grouped[section.key];
        if (!items || items.length === 0) return null;
        return (
          <section key={section.key}>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {section.title}
            </h3>
            <div className="flex flex-wrap gap-2">
              {items.map(({ slug, title, Icon }) => (
                <Link
                  key={slug}
                  href={`/${slug}`}
                  className="group inline-flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm transition-colors hover:border-foreground/30 hover:bg-muted/40"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="font-medium">{title}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
