import { db } from "@/lib/db";
import { mUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { isActive, role } = body;

  try {
    const [user] = await db.transaction(async (tx) => {
      const oldUser = await tx.query.mUsers.findFirst({
        where: eq(mUsers.id, id),
      });

      const [updated] = await tx
        .update(mUsers)
        .set({
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
          role: role || undefined,
          updatedBy: session.user.id,
          updatedOn: new Date(),
        })
        .where(eq(mUsers.id, id))
        .returning({
          id: mUsers.id,
          name: mUsers.name,
          email: mUsers.email,
          isActive: mUsers.isActive,
          role: mUsers.role,
        });

      if (updated) {
        await writeAuditLog(tx, {
          tableName: "m_users",
          recordId: 0, // Using 0 or a dummy value as users.id is a uuid text, not bigint.
          actionType: "update",
          oldDataJson: oldUser || null,
          newDataJson: updated,
          createdBy: session.user.id,
        });
      }

      return [updated];
    });

    return NextResponse.json(user);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      const oldUser = await tx.query.mUsers.findFirst({
        where: eq(mUsers.id, id),
      });

      await tx
        .update(mUsers)
        .set({
          deletedOn: now,
          deletedBy: session.user.id,
          isActive: false,
        })
        .where(eq(mUsers.id, id));

      await writeAuditLog(tx, {
        tableName: "m_users",
        recordId: 0,
        actionType: "delete",
        oldDataJson: oldUser || null,
        newDataJson: { deletedOn: now, deletedBy: session.user.id, isActive: false },
        createdBy: session.user.id,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete user" },
      { status: 500 }
    );
  }
}
