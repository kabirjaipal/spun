import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mCompanies, mCustomers, mSuppliers, mProducts, mLedgers, mTaxRates } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  const companyId = Number(session.user.companyId);

  const company = await db.query.mCompanies.findFirst({
    where: eq(mCompanies.companyId, companyId),
  });

  const [customerCount, supplierCount, productCount, ledgerCount, taxRateCount] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(mCustomers)
      .where(and(eq(mCustomers.companyId, companyId), isNull(mCustomers.deletedOn))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mSuppliers)
      .where(and(eq(mSuppliers.companyId, companyId), isNull(mSuppliers.deletedOn))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mProducts)
      .where(and(eq(mProducts.companyId, companyId), isNull(mProducts.deletedOn))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mLedgers)
      .where(and(eq(mLedgers.companyId, companyId), isNull(mLedgers.deletedOn))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mTaxRates)
      .where(isNull(mTaxRates.deletedOn)),
  ]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Company Settings</h1>
        <p className="text-sm text-muted-foreground">
          View your company profile, financial year, and active master counts.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Company Profile</h2>
          <div className="mt-4 space-y-4 text-sm text-foreground">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Name</p>
              <p>{company?.companyName || "Not configured"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">GSTIN</p>
              <p>{company?.gstNo || "Not configured"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Address</p>
              <p>{company?.address || "Not configured"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Master Data Status</h2>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Customers</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{customerCount?.count ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Suppliers</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{supplierCount?.count ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Products</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{productCount?.count ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Ledgers</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{ledgerCount?.count ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Tax Rates</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{taxRateCount?.count ?? 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
