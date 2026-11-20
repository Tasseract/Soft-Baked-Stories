"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { MENU_TAG } from "@/lib/catalog";
import { flavorName, isMixProduct, mixId, slugify, type Option } from "@/lib/menu";

const BUCKET = "product-images";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" };

export type ProductInput = {
  id?: string;
  name: string;
  description: string;
  category: string;
  active: boolean;
  options: { id?: string; label: string; price: number; mix?: [string, string] }[];
};

type Result = { error?: string; id?: string };

function refresh() {
  updateTag(MENU_TAG); // storefront shows the change on the next visit
  revalidatePath("/admin/menu");
}

export async function saveProduct(input: ProductInput): Promise<Result> {
  await requireAdmin();

  const name = input.name?.trim().slice(0, 80);
  if (!name) return { error: "Give the product a name." };
  const description = (input.description ?? "").trim().slice(0, 500);
  const category = (input.category ?? "").trim().slice(0, 30) || "Muffins";

  const options: Option[] = [];
  const seen = new Set<string>();

  // Mix & match box: each row is a pair of flavors with its price
  if (input.options?.some((o) => o.mix)) {
    const { data: flavors } = await db().from("products").select("id, name, options").neq("id", input.id ?? "");
    const names = new Map((flavors ?? []).filter((f) => !isMixProduct(f)).map((f) => [f.id as string, flavorName(f.name)]));
    for (const o of input.options) {
      const [a, b] = o.mix ?? [];
      if (!a || !b || !names.has(a) || !names.has(b)) return { error: "Pick two flavors for every pairing." };
      if (a === b) return { error: "A pairing needs two different flavors." };
      const price = Math.round(Number(o.price));
      const label = `${names.get(a)} + ${names.get(b)}`;
      if (!Number.isFinite(price) || price < 1 || price > 100_000) return { error: `Check the price for ${label}.` };
      const id = mixId(a, b);
      if (seen.has(id)) return { error: `${label} is listed twice.` };
      seen.add(id);
      options.push({ id, label, price, mix: [a, b] });
    }
  }

  for (const o of options.length ? [] : (input.options ?? [])) {
    const label = o.label?.trim().slice(0, 30);
    const price = Math.round(Number(o.price));
    if (!label) return { error: "Every size needs a name, like “Per piece” or “Box of 6”." };
    if (!Number.isFinite(price) || price < 1 || price > 100_000) return { error: `Check the price for “${label}”.` };
    // Keep existing option ids so customers' bags still match after a rename
    let id = o.id || slugify(label) || "option";
    while (seen.has(id)) id += "-2";
    seen.add(id);
    options.push({ id, label, price });
  }
  if (options.length === 0) return { error: "Add at least one size with a price." };

  const row = { name, description, category, options, active: !!input.active };

  if (input.id) {
    const { error } = await db().from("products").update(row).eq("id", input.id);
    if (error) return { error: "Couldn't save the product. Try again." };
    refresh();
    return { id: input.id };
  }

  // New products go to the top of the menu, where the owner just added them
  const { data: first } = await db().from("products").select("sort_order").order("sort_order").limit(1).maybeSingle();
  const id = `${slugify(name) || "product"}-${randomBytes(2).toString("hex")}`;
  const { error } = await db()
    .from("products")
    .insert({ ...row, id, sort_order: (first?.sort_order ?? 10) - 10 });
  if (error) return { error: "Couldn't add the product. Has the latest schema.sql been run in Supabase?" };
  refresh();
  return { id };
}

export async function deleteProduct(id: string): Promise<Result> {
  await requireAdmin();
  const { data } = await db().from("products").select("image_url").eq("id", id).maybeSingle();
  const { error } = await db().from("products").delete().eq("id", id);
  if (error) return { error: "Couldn't delete the product. Try again." };
  await removeStoredImage(data?.image_url);
  refresh();
  return {};
}

export async function reorderProducts(ids: string[]): Promise<Result> {
  await requireAdmin();
  const results = await Promise.all(
    ids.slice(0, 200).map((id, i) => db().from("products").update({ sort_order: (i + 1) * 10 }).eq("id", id)),
  );
  if (results.some((r) => r.error)) return { error: "Couldn't save the new order. Try again." };
  refresh();
  return {};
}

export async function uploadProductImage(form: FormData): Promise<Result & { url?: string }> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const file = form.get("file");
  if (!id || !(file instanceof File)) return { error: "Pick a photo to upload." };
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { error: "Use a JPG, PNG or WebP photo." };
  if (file.size > MAX_IMAGE_BYTES) return { error: "That photo is too large. Try one under 4 MB." };

  const { data: product } = await db().from("products").select("image_url").eq("id", id).maybeSingle();
  if (!product) return { error: "Save the product first, then add its photo." };

  const path = `${id}/${Date.now()}.${ext}`;
  const storage = db().storage.from(BUCKET);
  const { error: uploadError } = await storage.upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (uploadError) return { error: "Upload failed. Has the latest schema.sql (which creates the photo bucket) been run?" };

  const url = storage.getPublicUrl(path).data.publicUrl;
  const { error } = await db().from("products").update({ image_url: url }).eq("id", id);
  if (error) return { error: "Couldn't attach the photo. Try again." };
  await removeStoredImage(product.image_url);
  refresh();
  return { url };
}

/** Deletes a photo we uploaded earlier. Built-in photos in /public are left alone. */
async function removeStoredImage(url: string | null | undefined) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  if (!url?.includes(marker)) return;
  await db().storage.from(BUCKET).remove([decodeURIComponent(url.split(marker)[1])]).catch(() => {});
}
