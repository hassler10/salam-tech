import { db } from "@/db";
import { subscribers } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * Comparaison des noms tolérante à la casse, aux accents et aux espaces multiples,
 * sans changer le nom affiché ni le nom stocké.
 */
export function normalizeIdentity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type IdentityMatch = typeof subscribers.$inferSelect;

/**
 * Retrouve un abonné par le numéro de sa carte ET ses deux noms.
 * Le numéro seul ne suffit jamais : il est visible sur la carte.
 */
export async function findSubscriberByIdentity(
  code: string,
  lastName: string,
  firstName: string,
): Promise<IdentityMatch | null> {
  const rows = await db
    .select()
    .from(subscribers)
    .where(
      sql`lower(${subscribers.cardNumber}) = lower(${code})
          or lower(${subscribers.code}) = lower(${code})`,
    )
    .limit(5);

  const expectedLast = normalizeIdentity(lastName);
  const expectedFirst = normalizeIdentity(firstName);
  return (
    rows.find(
      (row) =>
        normalizeIdentity(row.lastName) === expectedLast &&
        normalizeIdentity(row.firstName) === expectedFirst,
    ) ?? null
  );
}

/** Vérifie exclusivement le numéro de carte et l'identité du registre Media Salam. */
export async function findMediaSalamSubscriberByIdentity(
  cardNumber: string,
  lastName: string,
  firstName: string,
): Promise<IdentityMatch | null> {
  const rows = await db
    .select()
    .from(subscribers)
    .where(
      sql`lower(${subscribers.cardNumber}) = lower(${cardNumber})
          and ${subscribers.source} = 'media_salam'`,
    )
    .limit(5);

  const expectedLast = normalizeIdentity(lastName);
  const expectedFirst = normalizeIdentity(firstName);
  return (
    rows.find(
      (row) =>
        normalizeIdentity(row.lastName) === expectedLast &&
        normalizeIdentity(row.firstName) === expectedFirst,
    ) ?? null
  );
}
