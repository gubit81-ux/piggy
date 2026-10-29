import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getLedger, type LedgerExpense, type LedgerSale, type OutputType as LedgerOutput } from "../endpoints/ledger_GET.schema";
import { postLedger, type InputType, type OutputType as SaveOutput } from "../endpoints/ledger_POST.schema";
import { useAuth } from "./useAuth";

type Ledger = Exclude<LedgerOutput, { error: string }>;
type QueuedAction = {
  key: string;
  action: InputType;
  optimisticId?: string;
};

const cacheKey = (userId: number) => `pig-ledger-cache-v1:${userId}`;
const queueKey = (userId: number) => `pig-ledger-queue-v1:${userId}`;

function readCache(userId: number): Ledger | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Ledger;
    if (!value?.farm || !Array.isArray(value.expenses) || !Array.isArray(value.sales)) return null;
    return value;
  } catch {
    return null;
  }
}

function writeCache(userId: number, ledger: Ledger) {
  try {
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(ledger));
  } catch {
    // A full or disabled browser store should not block online recording.
  }
}

function readQueue(userId: number): QueuedAction[] {
  try {
    const raw = window.localStorage.getItem(queueKey(userId));
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter((item) => item && typeof item.key === "string" && item.action) : [];
  } catch {
    return [];
  }
}

function writeQueue(userId: number, queue: QueuedAction[]) {
  try {
    window.localStorage.setItem(queueKey(userId), JSON.stringify(queue));
  } catch {
    throw new Error("Browser storage is unavailable. Reconnect and try again before closing this page.");
  }
}

function offlineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true;
  return error instanceof Error && /network|fetch failed|failed to fetch|load failed|offline|connection/i.test(error.message);
}

function localExpense(id: string, row: InputType & { action: "add-expense" }): LedgerExpense {
  const e = row.expense;
  return { id, date: e.date, category: e.category, description: e.description, qty: e.qty, unit: e.unit, price: e.price, lineTotal: e.lineTotal ?? Math.round(e.qty * e.price * 100) / 100 };
}

function applyQueue(ledger: Ledger, queue: QueuedAction[]): Ledger {
  let next: Ledger = {
    farm: { ...ledger.farm },
    expenses: [...ledger.expenses],
    sales: [...ledger.sales],
  };

  for (const item of queue) {
    const action = item.action;
    switch (action.action) {
      case "add-expense":
        next.expenses = [...next.expenses, localExpense(item.optimisticId || `local-expense-${item.key}`, action)];
        break;
      case "delete-expense":
        next.expenses = next.expenses.filter((entry) => entry.id !== action.id);
        break;
      case "add-sale": {
        const sale = action.sale;
        next.sales = [...next.sales, {
          id: item.optimisticId || `local-sale-${item.key}`,
          date: sale.date, buyer: sale.buyer, heads: sale.heads, weightKg: sale.weightKg,
          pricePerKg: sale.pricePerKg, gross: Math.round(sale.weightKg * sale.pricePerKg * 100) / 100,
        }];
        break;
      }
      case "delete-sale":
        next.sales = next.sales.filter((entry) => entry.id !== action.id);
        break;
      case "clear-all":
        next.expenses = [];
        next.sales = [];
        break;
      case "update-farm":
        next.farm = { ...next.farm, ...action.farm };
        break;
      case "restore":
        next.farm = { ...next.farm, ...action.farm };
        next.expenses = action.expenses.map((e, index) => ({
          id: `local-expense-${item.key}-${index}`, date: e.date, category: e.category,
          description: e.description, qty: e.qty, unit: e.unit, price: e.price,
          lineTotal: e.lineTotal ?? Math.round(e.qty * e.price * 100) / 100,
        }));
        next.sales = action.sales.map((s, index) => ({
          id: `local-sale-${item.key}-${index}`, date: s.date, buyer: s.buyer,
          heads: s.heads, weightKg: s.weightKg, pricePerKg: s.pricePerKg,
          gross: Math.round(s.weightKg * s.pricePerKg * 100) / 100,
        }));
        break;
    }
  }
  return next;
}

function enqueue(userId: number, action: InputType): { queue: QueuedAction[]; queued: boolean } {
  let queue = readQueue(userId);
  const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  if (action.action === "restore" || action.action === "clear-all") {
    queue = [];
    queue.push({ key, action });
    writeQueue(userId, queue);
    return { queue, queued: true };
  }

  if (action.action === "delete-expense" && action.id.startsWith("local-expense-")) {
    const pendingAddIndex = queue.findIndex((entry) => entry.optimisticId === action.id && entry.action.action === "add-expense");
    if (pendingAddIndex >= 0) queue.splice(pendingAddIndex, 1);
    else {
      const restoreEntry = queue.find((entry) => entry.action.action === "restore" && action.id.startsWith(`local-expense-${entry.key}-`));
      if (restoreEntry && restoreEntry.action.action === "restore") {
        const index = Number(action.id.slice(`local-expense-${restoreEntry.key}-`.length));
        if (Number.isInteger(index) && index >= 0) restoreEntry.action.expenses.splice(index, 1);
      }
    }
    writeQueue(userId, queue);
    return { queue, queued: false };
  }
  if (action.action === "delete-sale" && action.id.startsWith("local-sale-")) {
    const pendingAddIndex = queue.findIndex((entry) => entry.optimisticId === action.id && entry.action.action === "add-sale");
    if (pendingAddIndex >= 0) queue.splice(pendingAddIndex, 1);
    else {
      const restoreEntry = queue.find((entry) => entry.action.action === "restore" && action.id.startsWith(`local-sale-${entry.key}-`));
      if (restoreEntry && restoreEntry.action.action === "restore") {
        const index = Number(action.id.slice(`local-sale-${restoreEntry.key}-`.length));
        if (Number.isInteger(index) && index >= 0) restoreEntry.action.sales.splice(index, 1);
      }
    }
    writeQueue(userId, queue);
    return { queue, queued: false };
  }

  let optimisticId: string | undefined;
  if (action.action === "add-expense") optimisticId = `local-expense-${key}`;
  if (action.action === "add-sale") optimisticId = `local-sale-${key}`;
  queue.push({ key, action, optimisticId });
  writeQueue(userId, queue);
  return { queue, queued: true };
}

async function flushQueue(userId: number): Promise<QueuedAction[]> {
  let queue = readQueue(userId);
  if (typeof navigator !== "undefined" && navigator.onLine === false) return queue;

  for (const entry of [...queue]) {
    try {
      await postLedger(entry.action);
      queue = queue.filter((item) => item.key !== entry.key);
      writeQueue(userId, queue);
    } catch (error) {
      if (offlineError(error)) return queue;
      throw error;
    }
  }
  return queue;
}

export function useLedger() {
  const queryClient = useQueryClient();
  const { authState } = useAuth();
  const userId = authState.type === "authenticated" ? authState.user.id : null;
  const queryKey = ["ledger", userId] as const;
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    if (userId === null) return;
    const onOnline = () => {
      setIsOnline(true);
      void queryClient.invalidateQueries({ queryKey: ["ledger", userId] });
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setPendingSyncCount(readQueue(userId).length);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [queryClient, userId]);

  const query = useQuery({
    queryKey,
    enabled: userId !== null,
    queryFn: async () => {
      if (userId === null) throw new Error("Please sign in to access your ledger.");
      const remainingBeforeRead = await flushQueue(userId);
      setPendingSyncCount(remainingBeforeRead.length);
      try {
        const result = await getLedger();
        if ("error" in result) throw new Error(result.error);
        writeCache(userId, result);
        const queue = readQueue(userId);
        setPendingSyncCount(queue.length);
        return applyQueue(result, queue);
      } catch (error) {
        const cached = readCache(userId);
        const isAuthError = error instanceof Error && /sign in|not authenticated|unauthenticated/i.test(error.message);
        if (cached && !isAuthError) {
          const queue = readQueue(userId);
          setPendingSyncCount(queue.length);
          return applyQueue(cached, queue);
        }
        throw error;
      }
    },
  });

  const mutation = useMutation({
    mutationFn: async (action: InputType): Promise<SaveOutput> => {
      if (userId === null) throw new Error("Please sign in to save ledger changes.");
      if ((action.action === "delete-expense" && action.id.startsWith("local-expense-")) || (action.action === "delete-sale" && action.id.startsWith("local-sale-"))) {
        const result = enqueue(userId, action);
        setPendingSyncCount(result.queue.length);
        return { ok: true, message: "Local entry updated." };
      }
      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false) throw new TypeError("The device is offline.");
        return await postLedger(action);
      } catch (error) {
        if (!offlineError(error)) throw error;
        const result = enqueue(userId, action);
        setPendingSyncCount(result.queue.length);
        return { ok: true, message: result.queued ? "Saved on this device. It will sync when you're back online." : "Local change updated. It will sync when you're back online." };
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  return { ...query, saveAction: mutation.mutateAsync, isSaving: mutation.isPending, isOnline, pendingSyncCount };
}
