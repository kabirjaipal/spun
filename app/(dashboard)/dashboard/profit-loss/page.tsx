import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ProfitLossPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Profit & Loss</h1>
      <p className="text-sm text-muted-foreground">
        Review revenue, cost of goods, and expense performance across the period.
      </p>
    </div>
  );
}
