import superjson from "superjson";
import { db } from "../helpers/db";
import { getServerUserSession } from "../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../helpers/getSetServerSession";
import { ensureFarm } from "../helpers/ensureFarm";
import type { OutputType } from "./ledger_GET.schema";

function dateOnly(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const farm = await ensureFarm(user.id);
    const [expenseRows, saleRows] = await Promise.all([
      db.selectFrom("expenses").selectAll().where("userId", "=", String(user.id)).orderBy("date", "desc").orderBy("createdAt", "desc").execute(),
      db.selectFrom("sales").selectAll().where("userId", "=", String(user.id)).orderBy("date", "desc").orderBy("createdAt", "desc").execute(),
    ]);

    const payload = {
      farm,
      expenses: expenseRows.map((row) => ({
        id: String(row.id), date: dateOnly(row.date), category: row.category,
        description: row.description, qty: Number(row.qty), unit: row.unit,
        price: Number(row.price), lineTotal: Number(row.lineTotal),
      })),
      sales: saleRows.map((row) => ({
        id: String(row.id), date: dateOnly(row.date), buyer: row.buyer,
        heads: Number(row.heads), weightKg: Number(row.weightKg),
        pricePerKg: Number(row.pricePerKg), gross: Number(row.gross),
      })),
    } satisfies Exclude<OutputType, { error: string }>;

    return new Response(superjson.stringify(payload), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    const status = error instanceof NotAuthenticatedError ? 401 : 500;
    if (status === 500) console.error("Ledger load failed:", error);
    return new Response(superjson.stringify({ error: status === 401 ? "Please sign in to access your ledger." : "Could not load your farm ledger. Please try again." } satisfies OutputType), {
      status, headers: { "Content-Type": "application/json" },
    });
  }
}