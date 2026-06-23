import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function JournalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Journal Voucher</h1>
      <p className="text-sm text-muted-foreground">
        This page will allow you to enter journal voucher entries for adjustments, accruals, and other accounting entries.
      </p>
    </div>
  );
}
