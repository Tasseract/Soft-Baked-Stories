import "server-only";
import { db } from "./supabase";
import type { Order } from "./orders";

/**
 * Saves an order. If the database hasn't been updated with a newer column yet
 * (client_ref, source…), the order is saved without it rather than lost.
 */
export async function insertOrder(row: Record<string, unknown>) {
  const data = { ...row };
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await db().from("orders").insert(data).select().single<Order>();
    const missing = res.error?.code === "PGRST204" && /'(\w+)' column/.exec(res.error.message)?.[1];
    if (missing && missing in data) {
      delete data[missing];
      continue;
    }
    return res;
  }
  return db().from("orders").insert(data).select().single<Order>();
}
