import { Eye } from "lucide-react";

import { clearViewAsRole } from "@/lib/auth/view-as";
import { ROLE_LABELS, type PlatformRole } from "@/lib/auth/roles";

export function ViewAsBanner({
  role,
  employee,
}: {
  role: PlatformRole | null;
  employee: boolean;
}) {
  const label = role ? `Viewing as ${ROLE_LABELS[role]}` : employee ? "Viewing as Employee" : null;
  if (!label) return null;
  return (
    <div className="flex items-center justify-center gap-3 border-b border-amber-500/40 bg-amber-500/15 px-4 py-1.5 text-xs text-amber-900 dark:text-amber-200 print:hidden">
      <span className="flex items-center gap-1.5 font-medium">
        <Eye className="h-3 w-3" />
        {label}
      </span>
      <form action={clearViewAsRole}>
        <button
          type="submit"
          className="rounded-md border border-amber-600/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-500/20 dark:border-amber-400/40 dark:text-amber-100"
        >
          Return to {employee ? "admin view" : "staff view"}
        </button>
      </form>
    </div>
  );
}
