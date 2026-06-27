import { db } from "@/lib/db";
import { mJobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const {
    jobName,
    address,
    gstNo,
    gstType,
    city,
    stateCode,
    phone,
    msmeRegistered,
    msmeType,
  } = await request.json();

  const [row] = await db.transaction(async (tx) => {
    const oldJ = await tx.query.mJobs.findFirst({
      where: and(eq(mJobs.jobId, Number(id)), eq(mJobs.companyId, companyId))
    });

    const [updated] = await tx
      .update(mJobs)
      .set({
        jobName,
        address: address || null,
        gstNo: gstNo ? gstNo.trim().toUpperCase() : null,
        gstType: gstType || "unregistered",
        city: city || null,
        stateCode: stateCode || null,
        phone: phone || null,
        msmeRegistered: !!msmeRegistered,
        msmeType: msmeType || "non_registered",
        updatedBy: userId,
        updatedOn: new Date(),
      })
      .where(and(eq(mJobs.jobId, Number(id)), eq(mJobs.companyId, companyId)))
      .returning();

    if (updated) {
      await writeAuditLog(tx, {
        tableName: "m_jobs",
        recordId: Number(id),
        actionType: "update",
        oldDataJson: oldJ || null,
        newDataJson: updated,
        createdBy: userId,
      });
    }

    return [updated];
  });

  return NextResponse.json(row);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { id } = await params;
  const companyId = Number(session.user.companyId);
  const userId = session.user.id;
  const now = new Date();

  await db.transaction(async (tx) => {
    const oldJ = await tx.query.mJobs.findFirst({
      where: and(eq(mJobs.jobId, Number(id)), eq(mJobs.companyId, companyId))
    });

    await tx
      .update(mJobs)
      .set({ deletedOn: now, deletedBy: userId })
      .where(and(eq(mJobs.jobId, Number(id)), eq(mJobs.companyId, companyId)));

    await writeAuditLog(tx, {
      tableName: "m_jobs",
      recordId: Number(id),
      actionType: "delete",
      oldDataJson: oldJ || null,
      newDataJson: { deletedOn: now, deletedBy: userId },
      createdBy: userId,
    });
  });

  return NextResponse.json({ success: true });
}
