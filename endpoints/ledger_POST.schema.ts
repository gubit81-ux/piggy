import superjson from "superjson";
import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid YYYY-MM-DD date.");
const expenseSchema = z.object({
  date: dateSchema,
  category: z.string().trim().min(1).max(100),
  description: z.string().max(500).default(""),
  qty: z.number().finite().min(0).max(1000000),
  unit: z.string().trim().min(1).max(50),
  price: z.number().finite().min(0).max(100000000),
  lineTotal: z.number().finite().min(0).max(100000000000).optional(),
});
const saleSchema = z.object({
  date: dateSchema,
  buyer: z.string().max(250).default(""),
  heads: z.number().int().min(0).max(100000),
  weightKg: z.number().finite().min(0).max(100000000),
  pricePerKg: z.number().finite().min(0).max(100000000),
});
const farmSchema = z.object({ name: z.string().trim().min(1).max(180), pigCount: z.number().int().min(0).max(1000000) });
const idSchema = z.string().regex(/^[1-9]\d{0,17}$/, "Invalid record ID.");

export const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add-expense"), expense: expenseSchema }),
  z.object({ action: z.literal("delete-expense"), id: idSchema }),
  z.object({ action: z.literal("add-sale"), sale: saleSchema }),
  z.object({ action: z.literal("delete-sale"), id: idSchema }),
  z.object({ action: z.literal("clear-all") }),
  z.object({ action: z.literal("update-farm"), farm: farmSchema }),
  z.object({ action: z.literal("restore"), farm: farmSchema, expenses: z.array(expenseSchema).max(2000), sales: z.array(saleSchema).max(2000) }),
]);

export type InputType = z.infer<typeof schema>;
export type OutputType = { ok: true; message: string } | { error: string };

export const postLedger = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch("/_api/ledger", {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = superjson.parse<OutputType>(await result.text());
  if (!result.ok || "error" in payload) throw new Error("error" in payload ? payload.error : "Could not save ledger changes.");
  return payload;
};