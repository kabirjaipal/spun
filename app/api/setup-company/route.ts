import { db } from "@/lib/db";
import { mCompanies, mUsers } from "@/lib/db/schema";
import { auth } from "@/auth";
import { eq, sql, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { companyName, gstNo, address } = body;

    if (!companyName) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      // Check if a company with the same name already exists (case-insensitive)
      const existingCompany = await tx.query.mCompanies.findFirst({
        where: (companies, { eq, sql }) => eq(sql`lower(${companies.companyName})`, companyName.toLowerCase()),
      });

      if (existingCompany) {
        // Check if there is an owner associated with this company
        const existingOwner = await tx.query.mUsers.findFirst({
          where: (users, { eq, and }) => and(
            eq(users.companyId, BigInt(existingCompany.companyId)),
            eq(users.role, "owner")
          ),
        });

        if (existingOwner && existingOwner.id !== session.user.id) {
          throw new Error("Company with this name already exists");
        }

        // Reuse the existing company, link user to it and set as owner
        await tx
          .update(mUsers)
          .set({ 
            companyId: BigInt(existingCompany.companyId),
            role: "owner"
          })
          .where(eq(mUsers.id, session.user.id));

        // Update the company's updatedBy field to track this action
        await tx
          .update(mCompanies)
          .set({ updatedBy: session.user.id })
          .where(eq(mCompanies.companyId, existingCompany.companyId));

        return existingCompany;
      }

      // 1. Create company
      const [newCompany] = await tx
        .insert(mCompanies)
        .values({
          companyName,
          gstNo: gstNo || null,
          address: address || null,
          createdBy: session.user.id,
          updatedBy: session.user.id,
        })
        .returning({ companyId: mCompanies.companyId });

      // 2. Associate user with company and assign owner role
      await tx
        .update(mUsers)
        .set({ 
          companyId: BigInt(newCompany.companyId),
          role: "owner"
        })
        .where(eq(mUsers.id, session.user.id));

      return newCompany;
    });

    return NextResponse.json({
      message: "Company set up successfully",
      companyId: result.companyId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to set up company" },
      { status: 500 }
    );
  }
}
