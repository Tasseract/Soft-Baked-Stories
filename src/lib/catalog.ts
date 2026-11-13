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

// Errors are thrown inside the cached function so a failed lookup is never cached
const cachedProducts = unstable_cache(
  async () => {
    const { data, error } = await db().from("products").select("*").order("sort_order").order("created_at");
    if (error) throw error;
    return (data as ProductRow[]).map(toProduct);
  },
  ["products-v1"],
  { tags: [MENU_TAG], revalidate: 3600 },
);

/** Every product, including hidden ones. Falls back to the built-in menu if the database is unavailable. */
export async function getAllProducts(): Promise<Product[]> {
  try {
    const products = await cachedProducts();
    return products.length ? products : DEFAULT_PRODUCTS;
  } catch (err) {
    console.error("Menu lookup failed, using the built-in menu", err);
    return DEFAULT_PRODUCTS;
  }
}

/** Products customers can order */
export async function getMenu() {
  return (await getAllProducts()).filter((p) => p.active !== false && p.options.length > 0);
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
