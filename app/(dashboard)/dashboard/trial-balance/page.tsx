import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function TrialBalancePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Trial Balance</h1>
      <p className="text-sm text-muted-foreground">
        Generate trial balance reports to verify that debits equal credits across your ledger.
      </p>
    </div>
  );
}
