import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "./supabase";
import { DEFAULT_PRODUCTS, PLACEHOLDER_IMAGE, type Product } from "./menu";

export const MENU_TAG = "menu";
export const SETTINGS_TAG = "settings";

export type ProductRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  image_url: string | null;
  options: Product["options"];
  active: boolean;
  sort_order: number;
};

export const toProduct = (r: ProductRow): Product => ({
  id: r.id,
  name: r.name,
  description: r.description,
  category: r.category,
  image: r.image_url || PLACEHOLDER_IMAGE,
  options: r.options,
  active: r.active,
});

async function fetchProducts() {
  const { data, error } = await db().from("products").select("*").order("sort_order").order("created_at");
  if (error) throw error;
  return (data as ProductRow[]).map(toProduct);
}

// Errors are thrown inside the cached function so a failed lookup is never cached
const cachedProducts = unstable_cache(
  fetchProducts,
  ["products-v1"],
  { tags: [MENU_TAG], revalidate: 3600 },
);

/**
 * Every product, including hidden ones. Falls back to the built-in menu if the database is unavailable.
 * `fresh` skips the cache, for when a cached copy might be behind what a customer was shown.
 */
export async function getAllProducts({ fresh = false } = {}): Promise<Product[]> {
  try {
    const products = await (fresh ? fetchProducts() : cachedProducts());
    return products.length ? products : DEFAULT_PRODUCTS;
  } catch (err) {
    console.error("Menu lookup failed, using the built-in menu", err);
    return DEFAULT_PRODUCTS;
  }
}

/**
 * Drops products that are hidden or have nothing to order, and mix & match pairings
 * whose flavors are hidden or deleted.
 */
export function orderable(products: Product[], { includeHidden = false } = {}) {
  const live = new Set(products.filter((p) => includeHidden || p.active !== false).map((p) => p.id));
  return products
    .filter((p) => live.has(p.id))
    .map((p) => ({ ...p, options: p.options.filter((o) => !o.mix || o.mix.every((id) => live.has(id))) }))
    .filter((p) => p.options.length > 0);
}

/** Products customers can order */
export async function getMenu({ fresh = false } = {}) {
  return orderable(await getAllProducts({ fresh }));
}

export type ThemeMode = "light" | "dark" | "auto";
const THEMES: ThemeMode[] = ["light", "dark", "auto"];

const cachedTheme = unstable_cache(
  async () => {
    const { data, error } = await db().from("settings").select("value").eq("key", "theme").maybeSingle();
    if (error) throw error;
    return (data?.value as ThemeMode | undefined) ?? "light";
  },
  ["theme-v1"],
  { tags: [SETTINGS_TAG], revalidate: 3600 },
);

export async function getTheme(): Promise<ThemeMode> {
  try {
    const theme = await cachedTheme();
    return THEMES.includes(theme) ? theme : "light";
  } catch {
    return "light";
  }
}
