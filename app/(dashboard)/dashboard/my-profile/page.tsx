import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import ProfileClient from "./ProfileClient";

export default async function MyProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.query.mUsers.findFirst({
    where: eq(mUsers.id, session.user.id),
  });

  if (!user) redirect("/login");

  const userDetails = {
    name: user.name || "",
    email: user.email || "",
    role: user.role,
  };

  return <ProfileClient user={userDetails} />;
}
