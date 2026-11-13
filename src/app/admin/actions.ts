"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, requireAdmin, safeEqual, sessionToken } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { applyOrderPatch, type OrderPatch } from "@/lib/orders";

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

export async function updateOrder(id: string, patch: OrderPatch): Promise<{ error?: string }> {
  await requireAdmin();
  const { data: current, error: readError } = await db()
    .from("orders")
    .select("status, delivery_status, payment_method")
    .eq("id", id)
    .single();
  if (readError || !current) return { error: "Couldn't find that order. Refresh and try again." };

  const result = applyOrderPatch(current, patch);
  if ("error" in result) return result;
  if (Object.keys(result.patch).length === 0) return {};

  const { error } = await db().from("orders").update(result.patch).eq("id", id);
  if (error) return { error: "Couldn't save that change. Check your connection and try again." };
  revalidatePath("/admin", "layout");
  return {};
}
