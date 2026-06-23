import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "owner") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Users</h1>
      <p className="text-sm text-muted-foreground">
        Manage platform users, roles, and access permissions.
      </p>
    </div>
  );
}
