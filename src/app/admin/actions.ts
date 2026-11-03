"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, requireAdmin, safeEqual, sessionToken } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { DELIVERY_STATUSES, ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/orders";

export async function login(_: string | null, form: FormData) {
  const password = String(form.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return "ADMIN_PASSWORD isn't set on the server yet.";
  if (!safeEqual(password, expected)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return "That password isn't right.";
  }
  (await cookies()).set(SESSION_COOKIE, sessionToken()!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

export async function updateOrder(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id"));
  const patch: Record<string, string> = {};

  const status = form.get("status");
  if (status && (ORDER_STATUSES as readonly string[]).includes(String(status))) {
    patch.status = String(status);
    // Completing an order means it reached the customer; cash on delivery is collected at the door
    if (status === "completed") {
      patch.delivery_status = "delivered";
      if (form.get("payment_method") === "cod") patch.payment_status = "paid";
    }
  }
  const delivery = form.get("delivery_status");
  if (delivery && (DELIVERY_STATUSES as readonly string[]).includes(String(delivery))) patch.delivery_status = String(delivery);
  const payment = form.get("payment_status");
  if (payment && (PAYMENT_STATUSES as readonly string[]).includes(String(payment))) patch.payment_status = String(payment);

  if (Object.keys(patch).length === 0) return;
  const { error } = await db().from("orders").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin", "layout");
}
