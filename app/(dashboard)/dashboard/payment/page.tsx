import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function PaymentPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.companyId) redirect("/setup-company");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Payment Voucher</h1>
      <p className="text-sm text-muted-foreground">
        This page will allow you to record payment vouchers for supplier and expense payments.
      </p>
    </div>
  );
}
