import superjson from "superjson";
import { z } from "zod";

export const schema = z.object({});

export type LedgerExpense = {
  id: string;
  date: string;
  category: string;
  description: string;
  qty: number;
  unit: string;
  price: number;
  lineTotal: number;
};

export type LedgerSale = {
  id: string;
  date: string;
  buyer: string;
  heads: number;
  weightKg: number;
  pricePerKg: number;
  gross: number;
};

export type LedgerFarm = {
  id: string;
  name: string;
  pigCount: number;
  startDate: string;
};

export type OutputType = {
  farm: LedgerFarm;
  expenses: LedgerExpense[];
  sales: LedgerSale[];
} | { error: string };

export const getLedger = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch("/_api/ledger", {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = superjson.parse<OutputType>(await result.text());
  if (!result.ok && !("error" in payload)) throw new Error("Could not load your farm ledger.");
  return payload;
};