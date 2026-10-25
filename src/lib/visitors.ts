import { db } from "@/db";
import { visitors } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function createVisitorRecord(data: {
  lastName: string;
  firstName: string;
  phone?: string | null;
  organization?: string | null;
}) {
  const dup = await db
    .select()
    .from(visitors)
    .where(
      sql`lower(${visitors.lastName}) = lower(${data.lastName}) and lower(${visitors.firstName}) = lower(${data.firstName})`,
    )
    .limit(1);
  if (dup[0]) return dup[0];
  const seq = await db.select({ c: sql<number>`count(*)::int` }).from(visitors);
  const code = `VS-${new Date().getFullYear()}-${String((seq[0]?.c ?? 0) + 1).padStart(4, "0")}`;
  const [created] = await db
    .insert(visitors)
    .values({
      code,
      lastName: data.lastName,
      firstName: data.firstName,
      phone: data.phone ?? null,
      organization: data.organization ?? null,
    })
    .returning();
  return created;
}
