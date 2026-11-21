"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notifyNewOrder, validEmail } from "@/lib/email";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { getAllProducts, orderable } from "@/lib/catalog";
import { insertOrder } from "@/lib/order-store";
import { findOption } from "@/lib/menu";
import { ORDER_SOURCES, orderCode, type OrderItem, type OrderSource } from "@/lib/orders";

export type PosOrderInput = {
  client_ref: string;
  items: { product_id: string; option: string; quantity: number }[];
  customer_name: string;
  customer_email: string;
  phone: string;
  address: string;
  pickup: boolean;
  notes: string;
  source: OrderSource;
  payment_method: "cod" | "qr";
  paid: boolean;
  payment_reference: string;
};

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** An order the owner takes over chat, phone or in person */
export async function createPosOrder(input: PosOrderInput): Promise<{ code?: string; error?: string }> {
  await requireAdmin();

  const customer_name = text(input.customer_name, 80);
  if (!customer_name) return { error: "Add the customer's name." };
  const pickup = !!input.pickup;
  const address = pickup ? "Pickup" : text(input.address, 400);
  if (!address) return { error: "Add a delivery address, or switch to Pickup." };
  const email = text(input.customer_email, 120).toLowerCase();
  if (email && !validEmail(email)) return { error: "Check the email address." };
  const source = (ORDER_SOURCES as readonly string[]).includes(input.source) ? input.source : "other";
  const payment_method = input.payment_method === "qr" ? "qr" : "cod";

  // Read the menu straight from the database: the owner may have just edited it
  const menu = orderable(await getAllProducts({ fresh: true }), { includeHidden: true });
  const items: OrderItem[] = [];
  for (const raw of (input.items ?? []).slice(0, 50)) {
    const found = findOption(menu, String(raw.product_id), String(raw.option));
    const quantity = Math.floor(Number(raw.quantity));
    if (!found || !(quantity >= 1 && quantity <= 999)) continue;
    items.push({
      product_id: found.product.id,
      name: found.product.name,
      option: found.option.id,
      option_label: found.option.label,
      unit_price: found.option.price,
      quantity,
      line_total: found.option.price * quantity,
    });
  }
  if (items.length === 0) return { error: "Add at least one item." };

  const client_ref = /^[0-9a-f-]{36}$/i.test(input.client_ref) ? input.client_ref : null;
  const res = await insertOrder({
    customer_name,
    customer_email: email || null,
    phone: text(input.phone, 20),
    address,
    notes: text(input.notes, 300) || null,
    payment_method,
    payment_reference: text(input.payment_reference, 60) || null,
    payment_status: input.paid ? "paid" : "unpaid",
    status: "confirmed",
    source,
    items,
    total: items.reduce((n, i) => n + i.line_total, 0),
    client_ref,
  });

  if (res.error?.code === "23505" && client_ref) {
    // Tapped twice, or retried after a slow connection: it's already saved
    const existing = await db().from("orders").select("order_number").eq("client_ref", client_ref).single();
    if (existing.data) return { code: orderCode(existing.data.order_number) };
  }
  if (res.error || !res.data) return { error: "Couldn't save the order. Check your connection and try again." };

  revalidatePath("/admin", "layout");
  // The owner entered this order, so only the customer needs an email (if they gave one)
  const saved = res.data;
  after(() => notifyNewOrder(saved, { alertOwner: false }));
  return { code: orderCode(res.data.order_number) };
}
