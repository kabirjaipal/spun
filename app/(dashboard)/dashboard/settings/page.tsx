import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Company Settings</h1>
      <p className="text-sm text-muted-foreground">
        Update company details, financial year settings, and billing preferences.
      </p>
    </div>
  );
}
