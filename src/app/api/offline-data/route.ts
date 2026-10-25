import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscribers, visitors, visitReasons } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const subs = await db
    .select({
      id: subscribers.id,
      code: subscribers.code,
      lastName: subscribers.lastName,
      firstName: subscribers.firstName,
    })
    .from(subscribers)
    .limit(2000);
  const vis = await db
    .select({
      id: visitors.id,
      code: visitors.code,
      lastName: visitors.lastName,
      firstName: visitors.firstName,
    })
    .from(visitors)
    .limit(2000);
  const reasons = await db.select().from(visitReasons);
  return NextResponse.json({ subscribers: subs, visitors: vis, reasons });
}
