import { db } from "@/lib/db";
import { mUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, password } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const userId = session.user.id;

    const [updatedUser] = await db.transaction(async (tx) => {
      const oldUser = await tx.query.mUsers.findFirst({
        where: eq(mUsers.id, userId),
      });

      const updateData: Record<string, any> = {
        name,
        updatedBy: userId,
        updatedOn: new Date(),
      };

      if (password) {
        const salt = await bcrypt.genSalt(10);
        updateData.passwordHash = await bcrypt.hash(password, salt);
      }

      const [updated] = await tx
        .update(mUsers)
        .set(updateData)
        .where(eq(mUsers.id, userId))
        .returning({
          id: mUsers.id,
          name: mUsers.name,
          email: mUsers.email,
          role: mUsers.role,
        });

      if (updated) {
        await writeAuditLog(tx, {
          tableName: "m_users",
          recordId: 0,
          actionType: "update",
          oldDataJson: oldUser ? { name: oldUser.name, email: oldUser.email } : null,
          newDataJson: updated,
          createdBy: userId,
        });
      }

      return [updated];
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
