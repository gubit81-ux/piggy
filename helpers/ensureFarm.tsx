import { db } from "./db";

function dateOnly(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function ensureFarm(userId: number) {
  let farm = await db
    .selectFrom("farms")
    .select(["id", "name", "pigCount", "startDate"])
    .where("userId", "=", String(userId))
    .executeTakeFirst();

  if (!farm) {
    try {
      farm = await db
        .insertInto("farms")
        .values({ userId, name: "My Piggery", pigCount: 0 })
        .returning(["id", "name", "pigCount", "startDate"])
        .executeTakeFirstOrThrow();
    } catch (error) {
      // Two first requests can race to create the one-farm-per-account row.
      farm = await db
        .selectFrom("farms")
        .select(["id", "name", "pigCount", "startDate"])
        .where("userId", "=", String(userId))
        .executeTakeFirst();
      if (!farm) throw error;
    }
  }

  return {
    id: String(farm.id),
    name: farm.name,
    pigCount: Number(farm.pigCount),
    startDate: dateOnly(farm.startDate),
  };
}