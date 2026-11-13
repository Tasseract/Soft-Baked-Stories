import { NextResponse } from "next/server";
import { findOption } from "@/lib/menu";
import { getMenu } from "@/lib/catalog";
import { db } from "@/lib/supabase";
import { sendOrderEmail } from "@/lib/email";
import type { Order, OrderItem } from "@/lib/orders";
import { orderCode } from "@/lib/orders";

const PH_MOBILE = /^(\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot field filled in: pretend success so bots move on
  if (text(body.website, 200)) return NextResponse.json({ code: "SBS-0000" });

  const customer_name = text(body.customer_name, 80);
  const phone = text(body.phone, 20);
  const address = text(body.address, 400);
  const notes = text(body.notes, 300) || null;
  const payment_method = body.payment_method === "qr" ? "qr" : "cod";
  const payment_reference = payment_method === "qr" ? text(body.payment_reference, 60) : null;
  const client_ref = typeof body.client_ref === "string" && UUID.test(body.client_ref) ? body.client_ref : null;

  if (!customer_name || !address) return NextResponse.json({ error: "Please fill in your name and address." }, { status: 400 });
  if (!PH_MOBILE.test(phone)) return NextResponse.json({ error: "Please enter a valid PH mobile number." }, { status: 400 });
  if (payment_method === "qr" && !payment_reference)
    return NextResponse.json({ error: "Please enter your payment reference number." }, { status: 400 });

  // Prices always come from the server-side menu, never from the browser
  const menu = await getMenu();
  const items: OrderItem[] = [];
  for (const raw of Array.isArray(body.items) ? body.items.slice(0, 30) : []) {
    const found = findOption(menu, String(raw?.product_id), String(raw?.option));
    const quantity = Math.floor(Number(raw?.quantity));
    if (!found || !(quantity >= 1 && quantity <= 99)) continue;
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
  if (items.length === 0) return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });
  const total = items.reduce((n, i) => n + i.line_total, 0);

  let data: Order | null = null;
  try {
    const row = { customer_name, phone, address, notes, payment_method, payment_reference, items, total, client_ref };
    let res = await db().from("orders").insert(row).select().single<Order>();
    if (res.error?.code === "PGRST204") {
      // Database not yet updated with the client_ref column: save the order without it
      const { client_ref: _, ...legacy } = row;
      res = await db().from("orders").insert(legacy).select().single<Order>();
    }
    if (res.error?.code === "23505" && client_ref) {
      // A retry of a checkout that already went through: answer with the order we saved the first time
      const existing = await db().from("orders").select("order_number").eq("client_ref", client_ref).single();
      if (existing.data) return NextResponse.json({ code: orderCode(existing.data.order_number) });
    }
    if (res.error) throw res.error;
    data = res.data;
  } catch (err) {
    console.error("Failed to save order", err);
  }
  if (!data) {
    return NextResponse.json({ error: "We couldn't save your order. Please try again or message us." }, { status: 503 });
  }

  try {
    await sendOrderEmail(data);
  } catch (err) {
    // The order is already saved and visible in the admin dashboard, so a failed email isn't fatal
    console.error("Failed to email order", err);
  }

  return NextResponse.json({ code: orderCode(data.order_number) });
}
