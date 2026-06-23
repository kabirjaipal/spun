import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function GstReportsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">GST Reports</h1>
      <p className="text-sm text-muted-foreground">
        Generate GST summary reports for returns and transaction reconciliation.
      </p>
    </div>
  );
}
