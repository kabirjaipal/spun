import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mUsers } from "@/lib/db/schema";
import { isNull } from "drizzle-orm";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "owner") redirect("/dashboard");

  const users = await db
    .select({
      id: mUsers.id,
      name: mUsers.name,
      email: mUsers.email,
      isActive: mUsers.isActive,
      role: mUsers.role,
    })
    .from(mUsers)
    .where(isNull(mUsers.deletedOn))
    .orderBy(mUsers.name);

  return <UsersClient initialUsers={users} />;
}
