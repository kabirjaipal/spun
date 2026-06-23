import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LedgerReportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Ledger Report</h1>
      <p className="text-sm text-muted-foreground">
        View ledger balances and transaction summaries by account.
      </p>
    </div>
  );
}
