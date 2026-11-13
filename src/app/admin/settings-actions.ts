"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { MENU_TAG, SETTINGS_TAG, type ThemeMode } from "@/lib/catalog";
import { DEFAULT_PRODUCTS } from "@/lib/menu";

type Result = { error?: string };

export async function saveTheme(theme: ThemeMode): Promise<Result> {
  await requireAdmin();
  if (!["light", "dark", "auto"].includes(theme)) return { error: "Unknown theme." };
  const { error } = await db().from("settings").upsert({ key: "theme", value: theme, updated_at: new Date().toISOString() });
  if (error) return { error: "Couldn't save the theme. Has the latest schema.sql been run in Supabase?" };
  updateTag(SETTINGS_TAG);
  revalidatePath("/", "layout");
  return {};
}

/** Deletes every order and restarts numbering at SBS-0001 */
export async function purgeOrders(confirm: string): Promise<Result> {
  await requireAdmin();
  if (confirm !== "DELETE") return { error: "Type DELETE to confirm." };
  const { error } = await db().rpc("purge_orders");
  if (error) {
    // Older database without the purge function: delete the rows (numbering carries on)
    const fallback = await db().from("orders").delete().not("id", "is", null);
    if (fallback.error) return { error: "Couldn't delete the orders. Try again." };
  }
  revalidatePath("/admin", "layout");
  return {};
}

/** Removes added products and puts the original six back with their original prices and photos */
export async function resetMenu(confirm: string): Promise<Result> {
  await requireAdmin();
  if (confirm !== "RESET") return { error: "Type RESET to confirm." };
  const keep = DEFAULT_PRODUCTS.map((p) => p.id);
  const removed = await db().from("products").delete().not("id", "in", `(${keep.join(",")})`);
  if (removed.error) return { error: "Couldn't reset the menu. Has the latest schema.sql been run in Supabase?" };
  const { error } = await db()
    .from("products")
    .upsert(
      DEFAULT_PRODUCTS.map((p, i) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        image_url: p.image,
        options: p.options,
        active: true,
        sort_order: (i + 1) * 10,
      })),
    );
  if (error) return { error: "Couldn't reset the menu. Try again." };
  updateTag(MENU_TAG);
  revalidatePath("/admin", "layout");
  return {};
}
