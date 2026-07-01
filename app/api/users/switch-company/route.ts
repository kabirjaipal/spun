import { db } from "@/lib/db";
import { mCompanies, mUsers } from "@/lib/db/schema";
import { and, eq, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 });
    }

    const userId = session.user.id;
    const targetCompanyId = Number(companyId);

    // 1. Fetch the target company
    const targetCompany = await db.query.mCompanies.findFirst({
      where: and(
        eq(mCompanies.companyId, targetCompanyId),
        isNull(mCompanies.deletedOn)
      ),
    });

    if (!targetCompany) {
      return NextResponse.json({ error: "Target company not found" }, { status: 404 });
    }

    // 2. If the user already has a companyId, perform a security validation.
    // The user can switch to a main company they created OR within their current active company hierarchy.
    if (session.user.companyId) {
      const currentCompanyId = Number(session.user.companyId);

      const currentCompany = await db.query.mCompanies.findFirst({
        where: eq(mCompanies.companyId, currentCompanyId),
      });

      if (!currentCompany) {
        return NextResponse.json({ error: "Current company not found" }, { status: 500 });
      }

      const rootParentId = currentCompany.parentCompanyId || currentCompany.companyId;

      const isCreatedByUserMain = targetCompany.createdBy === userId && targetCompany.parentCompanyId === null;
      const isHierarchyAuthorized =
        targetCompany.companyId === rootParentId ||
        targetCompany.parentCompanyId === rootParentId;

      if (!isCreatedByUserMain && !isHierarchyAuthorized) {
        return NextResponse.json({ error: "Unauthorized access to this company" }, { status: 403 });
      }
    }

    // 3. Update the user's active company
    await db
      .update(mUsers)
      .set({ companyId: targetCompanyId })
      .where(eq(mUsers.id, userId));

    return NextResponse.json({ success: true, companyId: targetCompanyId });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to switch company" },
      { status: 500 }
    );
  }
}
