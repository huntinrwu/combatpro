import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!user.isStaff && user.approvedRoles.length === 0) {
    redirect("/pending");
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
  );
}
