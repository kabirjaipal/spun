import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function StockSummaryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Stock Summary</h1>
      <p className="text-sm text-muted-foreground">
        Stock summary gives you an overview of inventory levels, valuation, and stock availability.
      </p>
    </div>
  );
}
