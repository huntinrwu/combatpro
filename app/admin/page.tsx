import { redirect } from "next/navigation";

import { getSessionUser, requireStaff } from "@/lib/auth/session";

export default async function AdminIndex() {
  await requireStaff();
  const user = await getSessionUser();
  // Non-admin staff can only see People; admins land on Access requests.
  redirect(user?.isAdmin ? "/admin/access-requests" : "/admin/persons");
}
