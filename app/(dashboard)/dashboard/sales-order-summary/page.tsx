import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ShoppingCart, ArrowRight } from "lucide-react";

export default async function SalesOrderSummaryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      <div className="rounded-full bg-muted/30 p-6 border border-border">
        <ShoppingCart className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-bold text-foreground">Sales Order Summary</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Sales Orders are not yet tracked in this system. This feature allows you to raise and monitor pending sales orders against customers, track fulfillment status, and generate order-wise reports.
        </p>
        <p className="text-xs text-muted-foreground/60 border border-border rounded-md px-4 py-2 bg-muted/10 inline-flex items-center gap-2">
          <ArrowRight className="h-3 w-3" />
          This module can be enabled in a future update.
        </p>
      </div>
    </div>
  );
}
