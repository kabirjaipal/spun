import { db } from "@/lib/db";
import { tAuditLogs } from "@/lib/db/schema";

interface AuditLogParams {
  tableName: string;
  recordId: number;
  actionType: "create" | "update" | "delete" | "approve";
  oldDataJson?: any;
  newDataJson?: any;
  createdBy?: string | null;
}

/**
 * Utility to write a record to the t_audit_logs table.
 * Accepts an optional transaction client (tx) to perform the insert as part of a transaction.
 */
export async function writeAuditLog(
  tx: any,
  params: AuditLogParams
) {
  const client = tx || db;
  try {
    await client.insert(tAuditLogs).values({
      tableName: params.tableName,
      recordId: params.recordId,
      actionType: params.actionType,
      oldDataJson: params.oldDataJson ? params.oldDataJson : null,
      newDataJson: params.newDataJson ? params.newDataJson : null,
      createdBy: params.createdBy || null,
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
