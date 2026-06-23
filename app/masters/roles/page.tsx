import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function RolesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "owner") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Roles & Access</h1>
      <p className="text-sm text-muted-foreground">
        Configure role definitions and permission assignments for system users.
      </p>
    </div>
  );
}
