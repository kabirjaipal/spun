import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getStaticPermissionsForRole } from "@/lib/permissions";
import RolesClient from "./RolesClient";

export default async function RolesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "owner") redirect("/dashboard");

  const ownerPermissions = getStaticPermissionsForRole("owner");
  const companyPermissions = getStaticPermissionsForRole("company");

  return (
    <RolesClient
      ownerPermissions={ownerPermissions}
      companyPermissions={companyPermissions}
    />
  );
}
