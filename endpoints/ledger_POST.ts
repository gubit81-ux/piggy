import superjson from "superjson";
import { db } from "../helpers/db";
import { getServerUserSession } from "../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../helpers/getSetServerSession";
import { ensureFarm } from "../helpers/ensureFarm";
import { schema, type OutputType } from "./ledger_POST.schema";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export async function handle(request: Request) {
  try {
    const input = schema.parse(superjson.parse(await request.text()));
    const { user } = await getServerUserSession(request);

    switch (input.action) {
      case "add-expense": {
        const e = input.expense;
        await db.insertInto("expenses").values({
          userId: user.id, date: e.date, category: e.category,
          description: e.description.trim(), qty: e.qty, unit: e.unit,
          price: e.price, lineTotal: round2(e.qty * e.price),
        }).executeTakeFirstOrThrow();
        return response({ ok: true, message: "Expense saved." });
      }
      case "delete-expense": {
        await db.deleteFrom("expenses").where("userId", "=", String(user.id)).where("id", "=", input.id).execute();
        return response({ ok: true, message: "Expense deleted." });
      }
      case "add-sale": {
        const s = input.sale;
        await db.insertInto("sales").values({
          userId: user.id, date: s.date, buyer: s.buyer.trim(), heads: s.heads,
          weightKg: s.weightKg, pricePerKg: s.pricePerKg,
          gross: round2(s.weightKg * s.pricePerKg),
        }).executeTakeFirstOrThrow();
        return response({ ok: true, message: "Sale saved." });
      }
      case "delete-sale": {
        await db.deleteFrom("sales").where("userId", "=", String(user.id)).where("id", "=", input.id).execute();
        return response({ ok: true, message: "Sale deleted." });
      }
      case "clear-all": {
        await db.transaction().execute(async (trx) => {
          await trx.deleteFrom("expenses").where("userId", "=", String(user.id)).execute();
          await trx.deleteFrom("sales").where("userId", "=", String(user.id)).execute();
        });
        return response({ ok: true, message: "All farm ledger records deleted." });
      }
      case "update-farm": {
        const farm = await ensureFarm(user.id);
        await db.updateTable("farms").set({ name: input.farm.name, pigCount: input.farm.pigCount, updatedAt: new Date() }).where("id", "=", farm.id).where("userId", "=", String(user.id)).executeTakeFirstOrThrow();
        return response({ ok: true, message: "Farm settings saved." });
      }
      case "restore": {
        const farm = await ensureFarm(user.id);
        await db.transaction().execute(async (trx) => {
          await trx.deleteFrom("expenses").where("userId", "=", String(user.id)).execute();
          await trx.deleteFrom("sales").where("userId", "=", String(user.id)).execute();
          await trx.updateTable("farms").set({ name: input.farm.name, pigCount: input.farm.pigCount, updatedAt: new Date() }).where("id", "=", farm.id).where("userId", "=", String(user.id)).executeTakeFirstOrThrow();
          if (input.expenses.length) {
            await trx.insertInto("expenses").values(input.expenses.map((e) => ({
              userId: user.id, date: e.date, category: e.category, description: e.description.trim(), qty: e.qty,
              unit: e.unit, price: e.price, lineTotal: e.lineTotal === undefined ? round2(e.qty * e.price) : e.lineTotal,
            }))).execute();
          }
          if (input.sales.length) {
            await trx.insertInto("sales").values(input.sales.map((s) => ({
              userId: user.id, date: s.date, buyer: s.buyer.trim(), heads: s.heads, weightKg: s.weightKg,
              pricePerKg: s.pricePerKg, gross: round2(s.weightKg * s.pricePerKg),
            }))).execute();
          }
        });
        return response({ ok: true, message: `Restored ${input.expenses.length} expense(s) and ${input.sales.length} sale(s).` });
      }
    }
  } catch (error) {
    if (error instanceof NotAuthenticatedError) return response({ error: "Please sign in to save ledger changes." }, 401);
    if (error instanceof Error && error.name === "ZodError") return response({ error: "Some submitted fields are invalid. Review your entries and try again." }, 400);
    console.error("Ledger save failed:", error);
    return response({ error: "Could not save your changes. Please try again." }, 500);
  }
}

function response(payload: OutputType, status = 200) {
  return new Response(superjson.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}