import { db } from "@/lib/db";
import { mCompanies, mUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, password, companyName, gstNo, address } = body;
    
    if (!email || !name || !password || !companyName) {
      return NextResponse.json(
        { error: "Missing required fields: email, name, password, companyName" },
        { status: 400 }
      );
    }
    
    // Check if user already exists
    const existingUser = await db.query.mUsers.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }
    
    const result = await db.transaction(async (tx) => {
      // Check if a company with the same name already exists (case-insensitive)
      const existingCompany = await tx.query.mCompanies.findFirst({
        where: (companies, { eq, sql }) => eq(sql`lower(${companies.companyName})`, companyName.toLowerCase()),
      });

      let targetCompanyId: number;

      if (existingCompany) {
        // Check if there is an owner associated with this company
        const existingOwner = await tx.query.mUsers.findFirst({
          where: (users, { eq, and }) => and(
            eq(users.companyId, Number(existingCompany.companyId)),
            eq(users.role, "owner")
          ),
        });

        if (existingOwner) {
          throw new Error("Company with this name already exists");
        }

        targetCompanyId = existingCompany.companyId;
      } else {
        // Create company
        const [newCompany] = await tx.insert(mCompanies).values({
          companyName,
          gstNo: gstNo || null,
          address: address || null,
        }).returning({ companyId: mCompanies.companyId });

        targetCompanyId = newCompany.companyId;
      }
      
      // 2. Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      
      // 3. Create user (explicitly set role to owner)
      const [newUser] = await tx.insert(mUsers).values({
        name,
        email,
        passwordHash,
        companyId: Number(targetCompanyId),
        role: "owner",
        isActive: true,
      }).returning({ id: mUsers.id, name: mUsers.name, email: mUsers.email });

      // Associate the company's creator fields with the newly created owner user
      await tx
        .update(mCompanies)
        .set({
          createdBy: newUser.id,
          updatedBy: newUser.id,
        })
        .where(eq(mCompanies.companyId, targetCompanyId));
      
      return { user: newUser, companyId: targetCompanyId };
    });
    
    return NextResponse.json(
      { message: "Registration successful", user: result.user, companyId: result.companyId },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to register" },
      { status: 500 }
    );
  }
}
